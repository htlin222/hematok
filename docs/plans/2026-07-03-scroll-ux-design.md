# Hematok — 滑到底不再撞牆:scroll pending UX

**Date:** 2026-07-03
**Status:** implemented

## 問題

滑到 feed 底部、下一頁還在載入時,使用者被「彈回」最後一張卡,感覺像被禁止捲動。

根本原因(不只是缺 spinner):

1. 容器是 `snap-y snap-mandatory`,但 loading 那格 h-screen spinner **沒有
   `snap-start`** — 不是合法 snap 點,捲動無法停留,於是橡皮筋彈回。spinner
   一直存在於 DOM,只是物理上不可達。
2. `useFeed.fetchArticles` 在 append 前 `await` 全部 8 張圖的預載
   (`Promise.allSettled(preloadImage…)`),慢網路下一頁要等數秒。
3. 觸發太晚:sentinel 在最後一張卡之後,`rootMargin: "100px"`,到牆邊才開始抓。

## 設計(與使用者逐項確認)

1. **Spinner 卡變成真 snap 點**:loading 格加 `snap-start`。主要出現在冷啟動
   (feed.json 首次下載)。
2. **提早三屏觸發**:observer 改 `root: scroller`、
   `rootMargin: "0px 0px 300% 0px"`。
3. **立刻 append、各卡自載圖**:拆掉預載 barrier;`HematokCard` 本來就有
   pulse 佔位 + onLoad 淡入,不需改。預載降級為 fire-and-forget 暖快取。
4. **本地卡先上,推薦到了往後插**:探索池是純本地的(feed.json 已整包載入),
   `fetchArticles` 同步 append `PAGE_SIZE` 張本地卡;`/recommend` 並行發出
   (同時最多一個 in-flight),回來後把推薦卡交錯插入「目前卡片 +2」之後的
   未讀區段。每頁推薦/探索比例會浮動 — 已接受。

### 實作地雷(一併修)

- **key 改為 `item.id`**:原本 `${id}-${index}`,中途插入會讓後面卡片 key 全變
  → 整批 remount。`seen` 集合保證同 session 不重複發同一張卡,id 即穩定 key。
- **不能插在使用者身前**:read-marking observer(≥60% 可見)同時維護
  `currentIdRef`;插入點 = `findIndex(currentId) + 2`,永不位移目前捲動位置。

## 驗收

- Slow 3G:滑到底可停在 spinner 卡,不被彈回。
- 正常網速:幾乎看不到 spinner 卡(提早三屏 + 即時 append)。
- `/recommend` 掛掉或逾時:feed 純本地降級,照樣無限滑。
- 推薦插入時:目前卡片與 scrollTop 不動,推薦出現在後方未讀區段。

import json
import re

descriptions = {
  "Plasma cell / plasmablast": "如何一眼認出: 尋找偏居一側的圓形核（常呈車輪狀或時鐘面濃縮染色質），搭配極為濃郁的深海軍藍細胞質，以及緊貼核旁的半月形亮白「淡染區（Golgi zone）」；若是 plasmablast 則核仁更明顯且染色質較疏鬆，但仍保有顯著的核旁淡染區與深藍色胞質。",
  "Promyelocyte / myeloblast": "如何一眼認出: Myeloblast 具有極高核質比、如薄紗般細緻的網狀染色質與清晰可見的淡色核仁；而 Promyelocyte 則體積驟增，細胞質與核上方密密麻麻爆發出大量粗大紫紅色的「嗜天青顆粒（primary azurophilic granules）」，並常可見偏心核旁的淡染高基氏體區。",
  "Erythroblast / nucleated RBC": "如何一眼認出: 尋找邊界極為圓整、像打孔機蓋上去的墨水滴狀深黑/紫黑緻密圓核（具棋盤狀濃縮塊斑），周圍包覆著平滑無顆粒、由灰藍漸變為粉橘色（接近成熟紅血球顏色）的均勻細胞質。",
  "Eosinophil precursor": "如何一眼認出: 在前驅髓系細胞中，尋找細胞質內同時混雜著深紫黑色/藍黑色初級顆粒與鮮豔發亮的磚紅/橘紅色次級顆粒（呈現特殊的「雙色斑駁混合顆粒」外觀），伴隨未完全分葉的偏心或微凹核。",
  "Pseudo–Pelger-Huët anomaly": "如何一眼認出: 成熟嗜中性白血球僅有 2 葉核且呈對稱的「夾鼻眼鏡狀（pince-nez）」或帶狀/花生狀無分葉單核，但其染色質卻極度粗糙厚重、深染濃縮（呈現完全成熟顆粒球的緻密特徵），與正常淡粉色含細顆粒的細胞質形成強烈對比。",
  "Faggot cell": "如何一眼認出: 在白血病性前髓細胞（APL）中，一眼即可看見細胞質內雜亂堆疊、成束成捆如柴薪狀（bundles of sticks）的眾多針狀紫紅色 Auer 氏小體（Auer rods），常伴隨腎形或雙葉凹折的幼嫩細胞核。",
  "Multinucleated proerythroblast": "如何一眼認出: 巨大體積的原始紅血球內出現 2 個或更多各自獨立、圓形且具清晰核仁的細胞核，並被一圈極度深邃濃烈的湛藍色（royal blue）無顆粒細胞質所包圍，邊緣常可見特徵性的耳狀凸起（cytoplasmic pseudopods/blebs）。",
  "Megaloblastic anemia": "如何一眼認出: 在周邊血液抹片中一眼可見體積顯著偏大且飽滿呈卵圓形的紅血球（macro-ovalocytes），並伴隨細胞核分葉多達5至6葉以上的巨型分葉過多嗜中性球（hypersegmented neutrophils）。骨髓抹片中則呈現顯著的「核質發育不同步（nuclear-cytoplasmic asynchrony）」，即細胞質已充血紅素而細胞核仍保持疏鬆細緻如篩網般的染色質。",
  "AML M4 with inv(16)": "如何一眼認出: 骨髓抹片在骨髓芽球與單核球系細胞增生的背景下，最關鍵標誌是出現大量異常且發育不良的嗜酸性前驅細胞。這些異常嗜酸球細胞質內混合充斥著粗大、深紫藍色（嗜鹼性）至橘紅色的奇異顆粒，且常伴隨未分葉或分葉異常的細胞核。",
  "PLL (Prolymphocytic leukemia)": "如何一眼認出: 抹片滿布均一中至大型、細胞質相對豐富的淋巴樣細胞，其最醒目的特徵是深染凝縮的細胞核正中央嵌著一顆巨大、極為突出且邊界清晰如「打孔（punched-out）」般的單一中央核仁。在極高白血球總數的背景下，該鮮明的「單一大核仁」形態能瞬間與成熟小淋巴球區分。",
  "Megakaryocytic dysplastic change": "如何一眼認出: 骨髓中巨核細胞呈現典型的發育不良核畸變，最特異的是體積異常微小且僅含單一或雙圓核的「微小巨核細胞（micromegakaryocytes）」。此外亦常見正常大小卻完全不分葉的單核巨核細胞，或多個完全分離孤立、狀如棋子或球狀的「多圓核/分散核（pawn-ball multinucleated forms）」巨核細胞。",
  "CAD (Cold agglutinin disease)": "如何一眼認出: 在低倍鏡下即可見全片紅血球失控地緊密黏聚成一團團如「一串串葡萄（grape-like clusters）」或不規則雪片狀的凝集團塊，即使在抹片均勻的羽狀邊緣也無法形成正常的單層紅血球分佈。當抹片或檢體回溫至37°C後，該不規則團聚現象會迅速解離消失。",
  "Thalassemia": "如何一眼認出: 抹片背景充斥著極為顯著的小球低色素（microcytic hypochromic）紅血球，並隨處可見經典靶心狀的「靶細胞（target cells/codocytes）」與細密均勻的嗜鹼性點彩（basophilic stippling）。在重型患者中更可見顯著的大小不均、形狀怪異的多形性與淚滴狀紅血球及有核紅血球增多。",
  "Malaria": "如何一眼認出: 紅血球內可見清晰細緻如「耳機狀或戒指狀（signet-ring trophozoites）」的藍色環狀滋養體，環上點綴著鮮紅色的染色質點。若為惡性瘧（P. falciparum），更有一眼即可確診的標誌性「香蕉狀或新月狀配子體（crescent/banana-shaped gametocyte）」，且胞質中央聚積著深棕褐色的瘧色素。",
  "Tumor nest (marrow metastatic tumor)": "如何一眼認出: 骨髓抹片邊緣或小粒周邊可見外來非造血系細胞緊密「抱團成簇（cohesive clusters）」聚集為合胞體樣的腫瘤巢（tumor nests）。簇內細胞核質比極高、染色質深染粗糙，且細胞相互緊貼擠壓呈現極為醒目的「核鑲嵌（nuclear molding）」與細胞邊界不清現象，與散在的造血系細胞形成強烈反差。",
  "AML M5 (Acute monocytic leukemia)": "如何一眼認出: 視野中充斥著大量體積巨大、形態奔放的單核母細胞，胞漿豐富呈經典的「灰藍色/磨砂玻璃樣」，且常有偽足或小空泡突出；細胞核極具特徵地呈現腦回狀扭曲、摺疊或深凹陷（cerebriform/folded），染色質纖細如蕾絲網狀，並伴有清晰顯眼的巨大核仁。",
  "Multiple myeloma": "如何一眼認出: 骨髓或抹片中可見成群偏心核（eccentric）的成熟或異型漿細胞，胞漿深染呈鮮明濃郁的皇家藍（royal blue），且核旁必有極醒目的半月形「核旁淡染區（perinuclear halo/Golgi hof）」；細胞核內粗大染色質沿核膜呈經典的「車輪狀/鐘面狀（clock-face/cartwheel）」輻射凝集，常伴隨紅血球如硬幣疊堆般的緡錢狀排列（Rouleaux formation）。",
  "Lymphoma": "如何一眼認出: 視野中出現大量形態異常、高度單株化的異型淋巴細胞，核形極度不規則且常帶有深裂隙、切跡或呈「臀狀核/花瓣狀（cleaved/buttock/flower-like）」；其核質比極高，染色質濃染結塊，胞漿少且清亮或深藍，完全缺乏骨髓系顆粒與 Auer 桿。",
  "Myelofibrosis": "如何一眼認出: 外周血抹片呈現極為震撼的「淚滴狀紅血球（dacryocytes）」滿布視野，伴隨幼紅細胞與未成熟中性粒細胞同現的「幼紅-幼粒血象（leukoerythroblastic picture）」以及巨大畸形血小板；骨髓抽吸常呈「乾抽（dry tap）」，切片下則見網狀纖維增生與緊密叢生、核形如雲朵般扭曲深染的異常巨核細胞。",
  "MDS": "如何一眼認出: 骨髓呈現顯著的三系病態造血（dysplasia），中性粒細胞可見胞漿脫顆粒/低顆粒伴隨經典的雙葉眼鏡狀「假性 Pelger-Huët 畸形」；紅血系可見巨幼樣變、核出芽、核橋與多核畸形；巨核系則常見核分葉低下或如淋巴細胞大小的單圓核「微小巨核細胞（micromegakaryocyte）」。",
  "Necrobiosis": "如何一眼認出: 視野中退化中性粒細胞的細胞核完全喪失正常分葉與染色質紋理，濃縮碎裂（pyknosis/karyorrhexis）為數顆極其圓潤、均質且漆黑發亮的致密球體，宛如散落在蒼白溶解胞漿內的「黑色彈珠」；胞漿邊界模糊或見泡沫樣空泡，是細胞凋亡與壞死性退變的直接印記。",
  "AML": "如何一眼認出: 骨髓或外周血被均一的原始骨髓母細胞（myeloblasts）鋪天蓋地佔據，細胞核大且染色質細緻均勻如薄紗，內含 2~4 個清澈顯眼的核仁；胞漿中若瞥見一根或數根鮮紅色、如縫衣針或結晶般的「Auer 桿（Auer rods）」，即可瞬間一錘定音判定為 AML。",
  "ALL": "如何一眼認出: 視野中鋪滿密密麻麻、大小相對均一且「核質比極高」的淋巴母細胞，胞漿極為狹窄僅如一圈微薄的淺藍色鑲邊且完全無顆粒；細胞核染色質較 AML 更顯緻密平滑或呈細粉砂狀，核仁隱約不明顯或僅見 1 個小核仁，絕無 Auer 桿。",
  "APL (APML)": "如何一眼認出: 抹片中充斥著異常早幼粒細胞，胞漿內塞滿粗大嗜天青顆粒，最具特徵的是可見多根 Auer rods 聚集成束的「柴捆細胞」（faggot cells）以及折疊或雙葉狀（butterfly-like）核。若為微顆粒變異型（vAPL），則以高度分葉折疊的腎形核伴胞漿稀疏粉塵狀細微顆粒為特徵。",
  "ATLL": "如何一眼認出: 周邊血抹片中出現高度特異性的「花瓣狀細胞」（flower cells / cloverleaf cells），其淋巴細胞核呈現深度凹陷的多葉分葉狀，排列宛如花朵花瓣。核染色質濃縮均勻，核仁不明顯，胞漿嗜鹼性且邊緣清晰。",
  "Waldenström macroglobulinemia": "如何一眼認出: 骨髓中呈現小淋巴細胞、漿細胞樣淋巴細胞（plasmacytoid lymphocytes）與成熟漿細胞的三合一混合浸潤，並常伴有肥大細胞（mast cells）增多及核內 Dutcher bodies 包涵體。周邊血抹片中常因高濃度單株 IgM 免疫球蛋白而出現極為顯著的紅血球緡錢狀排列（rouleaux formation）與均勻粉染的蛋白背景。",
  "CML": "如何一眼認出: 周邊血抹片展現如「微縮骨髓」般由母細胞、早幼、中幼、晚幼粒到成熟分葉嗜中性球的完整連續分化階梯光譜。其中以中幼粒細胞比例特別顯著（myelocyte bulge，中幼粒數量通常多於晚幼粒），並伴隨恆常顯著的嗜鹼性球增多（basophilia）。",
  "therapy-related AML": "如何一眼認出: 抹片中在骨髓母細胞顯著增多（≥20%）的同時，背景伴隨極為廣泛且嚴重的多系別病態造血（multilineage dysplasia）。常可見嗜中性球顯著顆粒缺失或假性 Pelger-Huët 畸形、紅血球巨幼樣變及核出芽，以及小型單圓核巨核細胞。",
  "MDS-RAEB": "如何一眼認出: 骨髓抹片中骨髓母細胞比例明確介於 5% 至 19% 之間（未達急性白血病 20% 門檻），細胞核質比高且核仁明顯。背景中可見橫跨紅系、粒系與巨核系的顯著病態造血（如假性 Pelger-Huët 畸形、脫顆粒中性球、微小巨核細胞等）。",
  "CML blast phase": "如何一眼認出: 在原本 CML 慢性期的顆粒球全光譜或嗜鹼性球增多背景下，突然被佔比 ≥20% 的原始細胞（myeloblasts 或 lymphoblasts）全面淹沒。原本連續分化的階梯光譜被大量幼稚母細胞阻斷，常伴隨明顯的重度血小板減少或貧血。",
  "Leukoerythroblastosis": "如何一眼認出: 周邊血抹片中「未成熟粒細胞」（如中幼粒、晚幼粒細胞）與「有核紅血球」（nucleated red blood cells）同時現身於同一個視野。紅血球形態中幾乎必定伴隨極為典型的淚滴狀紅血球（dacrocytes / teardrop cells），強烈提示骨髓浸潤或纖維化病變。",
  "Hyposegmented neutrophil": "如何一眼認出: 成熟嗜中性白血球僅有1至2個核葉，最典型呈現由一條細絲相連的雙葉對稱「夾鼻眼鏡狀（pince-nez）」或花生狀。其染色質高度濃集結塊呈深色塊狀（具備成熟細胞特徵，非幼稚細胞的疏鬆網狀），且胞漿帶有正常的粉紫色嗜中性顆粒。",
  "Basophilic stippling": "如何一眼認出: 紅血球胞漿內如灑了細胡椒粉般，散布著無數細小或粗顆粒狀的深藍至紫藍色點狀顆粒（為聚集的核糖體RNA）。這些點狀顆粒均勻分布於整個紅血球圓盤，而非單一孤立圓點或邊緣成簇分布。",
  "Howell–Jolly body": "如何一眼認出: 紅血球內偏邊緣處出現單一顆（極少數兩顆）邊緣完美平滑、質地均勻緻密的深紫黑色微小圓點（為DNA核殘餘）。其邊界極其銳利清晰，與散布全細胞的嗜鹼性點彩或形態零碎成簇的鐵粒小體截然不同。",
  "Pappenheimer body": "如何一眼認出: 在紅血球邊緣或周邊區域，可見2至數顆微小、形態不規則且成簇聚集的暗藍色顆粒（含鐵的鐵蛋白小體）。不同於平滑單一的Howell-Jolly body，其顆粒邊界零碎且常群聚，在普魯士藍鐵染色下會顯現鮮明的藍綠色。",
  "Schistocyte": "如何一眼認出: 紅血球破裂失去正常雙凹圓盤形態，呈現邊緣銳利且具尖角或斷裂尖端的破碎細胞，最典型為「頭盔狀（helmet cell）」、三角形或新月角狀。其碎片質地濃染且完全缺乏中央蒼白區（central pallor），為微血管纖維蛋白機械性切割的特徵表現。",
  "Immunoglobulin para-protein pattern": "如何一眼認出: 血液抹片背景呈現特有的均質淡紫藍色蛋白質毛玻璃狀染色，且紅血球因表面電荷被副蛋白中和而如一疊硬幣般整齊重疊排列成串（典型的緡錢狀形成 Rouleaux formation）。骨髓中則常可見成片浸潤的異常漿細胞，伴有深藍胞漿、核旁偏心透亮區或結晶與Dutcher小體等副蛋白沉積特徵。",
  "Foamy cell (Niemann–Pick)": "如何一眼認出: 骨髓中出現體積龐大的巨噬細胞，其膨大的胞漿內塞滿了無數微小、大小均勻且透亮的脂質空泡，呈現極具特徵的「肥皂泡泡（soap bubble）」或「桑椹狀（mulberry）」泡沫外觀。細胞核偏小且常被推擠至細胞邊緣，整體外觀蓬鬆如蜂窩。",
  "Mantle cell lymphoma morphology": "如何一眼認出: 視野中充斥著高度單一均勻（monomorphic）的中小型淋巴細胞，其細胞核具顯著的不規則凹陷、切跡或摺疊（cleaved/indented nuclei），染色質緻密濃縮且核仁不明顯。細胞僅有極為狹窄稀少的淡色胞漿邊緣，在骨髓切片中常呈結節狀或小梁旁（paratrabecular）浸潤。"
}

# Add regex patterns for each
patterns = {
    "AML M5 (Acute monocytic leukemia)": [r'\bAML M5\b', r'Acute monocytic leukemia'],
    "Multiple myeloma": [r'Multiple myeloma', r'\bmyeloma\b'],
    "Lymphoma": [r'\bLymphoma\b'],
    "Myelofibrosis": [r'Myelofibrosis', r'\bMF\b'],
    "MDS": [r'\bMDS\b'],
    "Necrobiosis": [r'Necrobiosis'],
    "AML": [r'\bAML\b'],
    "ALL": [r'\bALL\b'],
    "APL (APML)": [r'\bAPL\b', r'\bAPML\b'],
    "ATLL": [r'\bATLL\b', r'Adult T-cell leukemia'],
    "Waldenström macroglobulinemia": [r'Waldenström', r'\bWM\b'],
    "CML": [r'\bCML\b'],
    "therapy-related AML": [r'AML after medication', r'therapy-related AML'],
    "MDS-RAEB": [r'\bRAEB\b'],
    "CML blast phase": [r'CML, blast phase', r'CML BP'],
    "Leukoerythroblastosis": [r'Leukoerythroblastosis'],
    "Megaloblastic anemia": [r'Megaloblastic anemia'],
    "AML M4 with inv(16)": [r'AML M4', r'inversion 16', r'inv\(16\)'],
    "PLL (Prolymphocytic leukemia)": [r'\bPLL\b', r'Prolymphocytic leukemia'],
    "Megakaryocytic dysplastic change": [r'Megakaryocytic dysplastic'],
    "CAD (Cold agglutinin disease)": [r'\bCAD\b', r'Cold agglutinin disease'],
    "Thalassemia": [r'Thalassemia'],
    "Malaria": [r'Malaria'],
    "Tumor nest (marrow metastatic tumor)": [r'Tumor nest', r'metastatic tumor'],
    "Plasma cell / plasmablast": [r'Plasma cell', r'plasmablast'],
    "Promyelocyte / myeloblast": [r'Promyelocyte', r'myeloblast'],
    "Erythroblast / nucleated RBC": [r'Erythroblast', r'nucleated RBC'],
    "Eosinophil precursor": [r'Eosinophil precursor'],
    "Pseudo–Pelger-Huët anomaly": [r'Pelger-Huët', r'Pelger-Huet'],
    "Faggot cell": [r'Faggot cell'],
    "Multinucleated proerythroblast": [r'Proerythroblast'],
    "Hyposegmented neutrophil": [r'Hyposegmented neutrophil'],
    "Basophilic stippling": [r'Basophilic stippling'],
    "Howell–Jolly body": [r'Howell-Jolly', r'Howell - Jolly'],
    "Pappenheimer body": [r'Pappenheimer body'],
    "Schistocyte": [r'Schistocyte'],
    "Immunoglobulin para-protein pattern": [r'Immunoglobulin para-protein'],
    "Foamy cell (Niemann–Pick)": [r'Foamy cell', r'Niemann-Pick'],
    "Mantle cell lymphoma morphology": [r'Mantle cell lymphoma']
}

# Pre-compile regexes
compiled = {}
for key, words in patterns.items():
    compiled[key] = re.compile('|'.join(words), re.IGNORECASE)

with open('frontend/public/feed.json', 'r') as f:
    items = json.load(f)

count_updated = 0
for item in items:
    text_to_search = item.get('title', '') + ' ' + item.get('description', '') + ' ' + ' '.join(item.get('cats', []))
    matched_desc = []
    
    # Check each key
    for key, regex in compiled.items():
        if regex.search(text_to_search):
            matched_desc.append(descriptions[key])
    
    if matched_desc:
        item['High_Yield'] = True
        
        # Avoid duplicating if script is run twice
        if '如何一眼認出:' not in item.get('description', ''):
            append_str = "\n\n" + "\n".join(matched_desc)
            if item.get('description'):
                item['description'] = item['description'] + append_str
            else:
                item['description'] = append_str.strip()
        count_updated += 1

with open('frontend/public/feed.json', 'w') as f:
    json.dump(items, f, separators=(',', ':'))

print(f"Successfully tagged 'High_Yield' and appended vivid descriptions to {count_updated} items.")

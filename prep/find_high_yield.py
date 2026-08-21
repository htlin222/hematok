import json
import re

with open('frontend/public/feed.json', 'r') as f:
    items = json.load(f)

keywords = [
    r'\bAML M5\b', r'Acute monocytic leukemia', r'Multiple myeloma', r'\bmyeloma\b',
    r'\bLymphoma\b', r'Myelofibrosis', r'\bMDS\b', r'Necrobiosis', r'\bAML\b',
    r'\bALL\b', r'\bAPL\b', r'\bAPML\b', r'\bATLL\b', r'Adult T-cell leukemia',
    r'Waldenström', r'\bWM\b', r'\bCML\b', r'\bRAEB\b', r'Leukoerythroblastosis',
    r'\bMF\b', r'Megaloblastic anemia', r'AML M4', r'inversion 16', r'inv\(16\)',
    r'\bPLL\b', r'Prolymphocytic leukemia', r'Megakaryocytic dysplastic',
    r'\bCAD\b', r'Cold agglutinin disease', r'Thalassemia', r'Malaria',
    r'Tumor nest', r'metastatic tumor', r'Plasma cell', r'plasmablast',
    r'Promyelocyte', r'myeloblast', r'Erythroblast', r'nucleated RBC',
    r'Eosinophil precursor', r'Pelger-Huët', r'Howell-Jolly', r'Howell - Jolly', r'Faggot cell',
    r'Proerythroblast', r'Hyposegmented neutrophil', r'Basophilic stippling',
    r'Pappenheimer body', r'Schistocyte', r'Immunoglobulin para-protein',
    r'Foamy cell', r'Niemann-Pick', r'Mantle cell lymphoma'
]
regex = re.compile('|'.join(keywords), re.IGNORECASE)

high_yield_items = []
for item in items:
    text_to_search = item.get('title', '') + ' ' + item.get('description', '') + ' ' + ' '.join(item.get('cats', []))
    if regex.search(text_to_search):
        item['High_Yield'] = True
        high_yield_items.append(item['id'])
    else:
        pass # Not high yield

with open('frontend/public/feed.json', 'w') as f:
    json.dump(items, f, separators=(',', ':'))

with open('prep/high_yield_ids.json', 'w') as f:
    json.dump(high_yield_items, f)

print(f"Found {len(high_yield_items)} High Yield items out of {len(items)}")

"""Package private, original skill sources and derive the public catalogue."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.products'
COUNTS = {'conteudo': 15, 'estrategia': 10, 'sites': 25, 'video': 40}


def render_skill(item):
    front = f"---\nname: {item['id']}\ndescription: {json.dumps(item['description'], ensure_ascii=False)}\n---\n"
    steps = '\n'.join(f'- {step}' for step in item['steps'])
    return f"{front}\n# {item['name']}\n\n## Ponto de partida\n\n{item['input']}\n\n## Direção de trabalho\n\n{steps}\n\n## Entrega\n\n{item['output']}\n\n## Conferência\n\n{item['check']}\n"


def build():
    items = json.loads((PRIVATE / 'skills.json').read_text(encoding='utf-8'))
    assert len(items) == 90 and len({i['id'] for i in items}) == 90
    assert all(re.fullmatch(r'fb-[a-z0-9-]{3,59}', i['id']) for i in items)
    for pack, count in COUNTS.items():
        assert sum(i['package'] == pack for i in items) == count, pack
    manual = (PRIVATE / 'GUIA.md').read_text(encoding='utf-8')
    examples = (PRIVATE / 'EXEMPLOS.md').read_text(encoding='utf-8')
    outputs = PRIVATE / 'releases'
    outputs.mkdir(parents=True, exist_ok=True)
    release = {}
    catalogue = json.loads((ROOT / 'packages.json').read_text(encoding='utf-8'))
    for pack in catalogue['packages']:
        selected = items if pack['id'] == 'completo' else [i for i in items if i['package'] == pack['id']]
        if pack['id'] != 'completo':
            pack['skillIds'] = [i['id'] for i in selected]
            pack.pop('skillCategories', None)
        package_root = 'framebuilds-' + pack['id']
        archive = outputs / (pack['id'] + '.zip')
        index = '\n'.join(f"- {i['name']}: skills/{i['id']}/SKILL.md" for i in selected)
        introduction = f"# {pack['name']}\n\nVersão 1.0.0 · framebuilds.ai\n\n{len(selected)} rotinas originais de instruções para agentes de IA.\n\nLeia GUIA.md antes de começar. EXEMPLOS.md mostra pedidos e entregas de referência.\n\n## Conteúdo\n\n{index}\n"
        with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            def add(name, content):
                entry = zipfile.ZipInfo(name, date_time=(2026, 11, 26, 0, 0, 0))
                entry.compress_type = zipfile.ZIP_DEFLATED
                entry.external_attr = 0o644 << 16
                z.writestr(entry, content, compresslevel=9)
            add(package_root + '/LEIA-ME.md', introduction)
            add(package_root + '/GUIA.md', manual)
            add(package_root + '/EXEMPLOS.md', examples)
            for item in selected:
                skill = render_skill(item)
                source_dir = PRIVATE / 'skills' / item['id']
                source_dir.mkdir(parents=True, exist_ok=True)
                (source_dir / 'SKILL.md').write_text(skill, encoding='utf-8')
                add(f"{package_root}/skills/{item['id']}/SKILL.md", skill)
        data = archive.read_bytes()
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            assert len([n for n in z.namelist() if n.endswith('/SKILL.md')]) == len(selected)
        release[pack['id']] = {'fileName': archive.name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'skills': len(selected)}
    # Only summaries enter the public repository. Paid source files remain private.
    (ROOT / 'packages.json').write_text(json.dumps(catalogue, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    rows = []
    for item in items:
        # The static renderer reads this intentionally simple, single-quoted tuple format.
        values = [item[key].replace('\\', '\\\\').replace("'", "\\'") for key in ['id', 'name', 'category', 'description']]
        rows.append('  [' + ','.join("'" + value + "'" for value in values) + ']')
    public = '/* Catálogo das 90 rotinas originais da framebuilds.ai. Os arquivos completos são entregues nos pacotes. */\nwindow.FRAMEBUILDS_SKILLS = [\n' + ',\n'.join(rows) + '\n].map(([id,name,category,description])=>({id,name,category,description}));\n'
    (ROOT / 'dist/catalog.js').write_text(public, encoding='utf-8')
    (outputs / 'manifest.json').write_text(json.dumps(release, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'archives': release, 'originalSkills': len(items), 'salesOpened': False}, ensure_ascii=False))


if __name__ == '__main__':
    build()

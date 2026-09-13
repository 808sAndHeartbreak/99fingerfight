"""Package the built game, server and docs; exclude credentials and rooms."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
assert (root / 'dist/index.html').is_file(), 'Run npm run build first'
destination = root / 'release/finger-fight-release.zip'
destination.parent.mkdir(exist_ok=True)
temporary = destination.with_suffix('.tmp')
with ZipFile(temporary, 'w', ZIP_DEFLATED, compresslevel=6) as archive:
    for folder in ['dist', 'src', 'server', 'docs']:
        for path in sorted((root / folder).rglob('*')):
            if path.is_file() and path.suffix != '.conf':
                archive.write(path, path.relative_to(root).as_posix())
    for filename in ['package.json', 'package-lock.json', 'README.md']:
        archive.write(root / filename, filename)
with ZipFile(temporary) as archive:
    assert archive.testzip() is None
    assert 'src/tutorial.js' in archive.namelist()
    assert len([n for n in archive.namelist() if n.startswith('dist/assets/ink-mono/')]) == 35
temporary.replace(destination)
print(f'{destination}: {destination.stat().st_size:,} bytes')

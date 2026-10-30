"""Export an activity-independent coordinate sample from the pinned fly.ai archive."""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np

source = Path(sys.argv[1])
expected = 'cc9bd1ecd00bd703a6fa648bc6ad145c93c7c1ee53debdcc9ce0d1f4305e6aca'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected, 'Wrong brain archive'
with np.load(source, allow_pickle=False) as archive:
    positions = archive['positions']
    assert positions.shape == (166700, 3)
    valid = np.flatnonzero(np.isfinite(positions).all(axis=1))
    chosen = valid[np.linspace(0, len(valid) - 1, min(12000, len(valid)), dtype=int)]
    data = dict(source='MaleCNS positions from pinned fly.ai brain.npz',
                sourceArchiveSha256=expected, neurons=166700,
                selection='12000 uniformly spaced valid neuron indices, independent of activity',
                indices=chosen.tolist(), positions=positions[chosen].tolist())
Path('public/model/spatial.json').write_text(json.dumps(data, separators=(',', ':'))+'\n')
print(f'Exported {len(chosen)} measured coordinates from {len(valid)} valid neurons.')

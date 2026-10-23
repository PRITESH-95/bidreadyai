"""Database utilities for BidReady AI.

At this stage we only need to ensure the SQLite file exists. The actual schema
will be added later.
"""

import os
import sqlite3
from pathlib import Path

from .config import settings


def init_db() -> None:
    """Initialise the SQLite database file.

    Creates the directory for ``settings.DB_PATH`` if necessary and touches the
    file so that SQLite can open it later. No tables are created yet.
    """
    db_path = Path(settings.DB_PATH)
    # Ensure parent directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)
    # Touch the file – ``sqlite3.connect`` will create it if missing.
    if not db_path.exists():
        # Opening and closing ensures a valid empty SQLite file.
        conn = sqlite3.connect(db_path)
        conn.close()


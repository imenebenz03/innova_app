#!/usr/bin/env python3
"""
INNOVA — Script de lancement
Lance le backend Flask et affiche les instructions pour le frontend React
"""

import subprocess
import sys
import os
from pathlib import Path

ROOT    = Path(__file__).parent
BACKEND = ROOT / "backend"


def lancer_backend():
    """Lance le serveur Flask."""
    env = os.environ.copy()
    env["FLASK_ENV"] = "development"
    subprocess.run(
        [sys.executable, "app.py"],
        cwd=BACKEND,
        env=env
    )


def main():
    print("""
╔══════════════════════════════════════════════════════════╗
║              INNOVA by INNOVIM                           ║
║        Application de Gestion de Résidence               ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  DÉMARRAGE :                                             ║
║                                                          ║
║  1. Backend Flask  → lancé automatiquement               ║
║     URL API : http://localhost:5000/api                  ║
║                                                          ║
║  2. Frontend React → ouvrir un 2ème terminal :           ║
║     cd frontend-admin                                    ║
║     npm install                                          ║
║     npm run dev                                          ║
║     URL App : http://localhost:5173                      ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║  Comptes de démonstration :                              ║
║  Admin    : admin@innovim.dz       / admin123            ║
║  Résident : ahmed.karim@email.dz   / resident123         ║
╚══════════════════════════════════════════════════════════╝
    """)
    lancer_backend()


if __name__ == "__main__":
    main()

"""
INNOVA — Résidence INNOVIM (Algérie)
Couche base de données PostgreSQL
"""

import os
import hashlib
import hmac
import secrets
import psycopg2
from psycopg2 import IntegrityError
from psycopg2.extras import DictCursor
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL")


def _convert_sql(sql: str) -> str:
    """Convert old SQLite-style SQL to PostgreSQL SQL."""
    sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
    sql = sql.replace("REAL", "DOUBLE PRECISION")
    sql = sql.replace("last_insert_rowid()", "LASTVAL()")
    sql = sql.replace("?", "%s")

    if sql.strip().startswith("INSERT OR IGNORE INTO alertes_vues"):
        sql = sql.replace("INSERT OR IGNORE INTO alertes_vues", "INSERT INTO alertes_vues")
        sql += " ON CONFLICT (resident_id, alerte_id) DO NOTHING"

    if sql.strip().startswith("INSERT OR REPLACE INTO settings"):
        sql = sql.replace("INSERT OR REPLACE INTO settings", "INSERT INTO settings")
        sql += " ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur"

    return sql


class PGCursor:
    def __init__(self, cursor):
        self.cursor = cursor

    def execute(self, sql, params=None):
        self.cursor.execute(_convert_sql(sql), params or ())
        return self

    def executemany(self, sql, seq_of_params):
        self.cursor.executemany(_convert_sql(sql), seq_of_params)
        return self

    def executescript(self, script):
        statements = [s.strip() for s in script.split(";") if s.strip()]
        for statement in statements:
            self.cursor.execute(_convert_sql(statement))
        return self

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()


class PGConnection:
    def __init__(self):
        if not DATABASE_URL:
            raise RuntimeError("DATABASE_URL environment variable is missing.")
        self.conn = psycopg2.connect(DATABASE_URL, cursor_factory=DictCursor)

    def cursor(self):
        return PGCursor(self.conn.cursor())

    def execute(self, sql, params=None):
        cur = self.conn.cursor()
        cur.execute(_convert_sql(sql), params or ())
        return cur

    def executemany(self, sql, seq_of_params):
        cur = self.conn.cursor()
        cur.executemany(_convert_sql(sql), seq_of_params)
        return cur

    def commit(self):
        self.conn.commit()

    def rollback(self):
        self.conn.rollback()

    def close(self):
        self.conn.close()


def get_connection():
    return PGConnection()


def hash_password(password: str, salt: str = None) -> str:
    """Hash password with PBKDF2-HMAC-SHA256 and a random salt."""
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 260000)
    return f"{salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored hash. Supports legacy SHA256 and new PBKDF2."""
    if "$" in stored:
        salt, _ = stored.split("$", 1)
        return hmac.compare_digest(hash_password(password, salt), stored)
    # Legacy SHA256 fallback for existing data
    legacy = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return hmac.compare_digest(legacy, stored)


def upgrade_password_if_needed(conn, resident_id: int, password: str, stored: str):
    """Transparently upgrade legacy SHA256 hashes to PBKDF2 on successful login."""
    if "$" not in stored:
        new_hash = hash_password(password)
        conn.execute("UPDATE residents SET mot_de_passe=? WHERE id=?", (new_hash, resident_id))
        conn.commit()


def row_to_dict(row) -> dict:
    return dict(row) if row else None


def rows_to_list(rows) -> list:
    return [dict(r) for r in rows]


def generate_payment_ref(prefix: str, charge_id: int) -> str:
    """Generate a unique, non-guessable payment reference."""
    token = secrets.token_hex(4).upper()
    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    return f"{prefix}-{ts}-{charge_id}-{token}"


def init_db():
    conn = get_connection()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS residences (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            nom               TEXT    NOT NULL,
            nom_complet       TEXT    NOT NULL,
            adresse          TEXT,
            actif            INTEGER NOT NULL DEFAULT 1,
            date_creation    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS residents (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            residence_id      INTEGER NOT NULL,
            nom               TEXT    NOT NULL,
            prenom             TEXT    NOT NULL,
            email             TEXT    UNIQUE NOT NULL,
            mot_de_passe      TEXT    NOT NULL,
            unite             TEXT    NOT NULL,
            etage             INTEGER NOT NULL DEFAULT 0,
            telephone         TEXT,
            role              TEXT    NOT NULL DEFAULT 'resident',
            date_inscription  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS charges (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id     INTEGER NOT NULL,
            designation     TEXT    NOT NULL,
            montant_total   REAL    NOT NULL,
            montant_restant REAL    NOT NULL,
            echeance        TEXT    NOT NULL,
            statut          TEXT    NOT NULL DEFAULT 'en_attente',
            date_paiement   TEXT,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS paiements (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            charge_id       INTEGER NOT NULL,
            resident_id     INTEGER NOT NULL,
            montant         REAL    NOT NULL,
            methode         TEXT    NOT NULL DEFAULT 'en_ligne',
            reference       TEXT    UNIQUE,
            date_paiement   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            note            TEXT,
            FOREIGN KEY (charge_id)   REFERENCES charges(id) ON DELETE CASCADE,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            expediteur_id   INTEGER NOT NULL,
            destinataire_id INTEGER,
            canal           TEXT    NOT NULL,
            contenu         TEXT    NOT NULL,
            lu              INTEGER NOT NULL DEFAULT 0,
            date_envoi       TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (expediteur_id) REFERENCES residents(id) ON DELETE CASCADE,
            FOREIGN KEY (destinataire_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS alertes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            titre           TEXT    NOT NULL,
            contenu         TEXT    NOT NULL,
            type_alerte     TEXT    NOT NULL DEFAULT 'info',
            auteur_id       INTEGER NOT NULL,
            residence_id   INTEGER,
            active         INTEGER NOT NULL DEFAULT 1,
            date_creation  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (auteur_id) REFERENCES residents(id) ON DELETE CASCADE,
            FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cle             TEXT    UNIQUE NOT NULL,
            valeur          TEXT
        );

        CREATE TABLE IF NOT EXISTS alertes_vues (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id     INTEGER NOT NULL,
            alerte_id       INTEGER NOT NULL,
            date_vu         TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE,
            FOREIGN KEY (alerte_id) REFERENCES alertes(id) ON DELETE CASCADE,
            UNIQUE(resident_id, alerte_id)
        );

        CREATE TABLE IF NOT EXISTS residents (
            id                INTEGER PRIMARY KEY AUTOINCREMENT,
            residence_id      INTEGER NOT NULL,
            nom               TEXT    NOT NULL,
            prenom            TEXT    NOT NULL,
            email             TEXT    UNIQUE NOT NULL,
            mot_de_passe      TEXT    NOT NULL,
            unite             TEXT    NOT NULL,
            etage             INTEGER NOT NULL DEFAULT 0,
            telephone         TEXT,
            role              TEXT    NOT NULL DEFAULT 'resident',
            date_inscription  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS charges (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id     INTEGER NOT NULL,
            designation     TEXT    NOT NULL,
            montant_total   REAL    NOT NULL,
            montant_restant REAL    NOT NULL,
            echeance        TEXT    NOT NULL,
            statut          TEXT    NOT NULL DEFAULT 'en_attente',
            date_paiement   TEXT,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS paiements (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            charge_id       INTEGER NOT NULL,
            resident_id     INTEGER NOT NULL,
            montant         REAL    NOT NULL,
            methode         TEXT    NOT NULL DEFAULT 'en_ligne',
            reference       TEXT    UNIQUE,
            date_paiement   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            note            TEXT,
            FOREIGN KEY (charge_id)   REFERENCES charges(id) ON DELETE CASCADE,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS messages (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            expediteur_id   INTEGER NOT NULL,
            destinataire_id INTEGER,
            canal           TEXT    NOT NULL,
            contenu         TEXT    NOT NULL,
            date_envoi      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            lu              INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (expediteur_id)   REFERENCES residents(id) ON DELETE CASCADE,
            FOREIGN KEY (destinataire_id) REFERENCES residents(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS alertes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            residence_id     INTEGER,
            titre           TEXT    NOT NULL,
            contenu         TEXT    NOT NULL,
            type_alerte     TEXT    NOT NULL DEFAULT 'info',
            auteur_id       INTEGER NOT NULL,
            date_creation   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            active          INTEGER NOT NULL DEFAULT 1,
            FOREIGN KEY (residence_id) REFERENCES residences(id) ON DELETE SET NULL,
            FOREIGN KEY (auteur_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS requetes (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id     INTEGER NOT NULL,
            sujet           TEXT    NOT NULL,
            contenu         TEXT    NOT NULL,
            statut          TEXT    NOT NULL DEFAULT 'en_attente',
            reponse         TEXT,
            date_creation   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            date_reponse    TEXT,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id     INTEGER NOT NULL,
            titre           TEXT    NOT NULL,
            contenu         TEXT    NOT NULL,
            type_notif      TEXT    NOT NULL DEFAULT 'info',
            lu              INTEGER NOT NULL DEFAULT 0,
            date_creation   TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS device_tokens (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            resident_id     INTEGER NOT NULL,
            expo_token      TEXT    NOT NULL,
            type_app       TEXT    NOT NULL DEFAULT 'mobile',
            date_creation TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
        );
    """)

    conn.commit()
    ResidenceDB.seed_default()

    count = c.execute("SELECT COUNT(*) FROM residents").fetchone()[0]
    if count == 0:
        _seed_demo_data(c)

    conn.commit()
    conn.close()
    print("Base de donnees INNOVA initialisee -> PostgreSQL")


def _seed_demo_data(c):
    admin_pwd = hash_password("admin123")
    res_pwd   = hash_password("resident123")

    c.executemany(
        "INSERT INTO residents (residence_id,nom,prenom,email,mot_de_passe,unite,etage,telephone,role) VALUES (?,?,?,?,?,?,?,?,?)",
        [
            (3,"INNOVIM","Administration","admin@innovim.dz",        admin_pwd,"ADMIN",0,"+213 21 00 00 00","admin"),
            (1,"Karim",  "Ahmed",         "ahmed.karim@email.dz",    res_pwd,  "7C",  3,"+213 661 234 567","resident"),
            (1,"Boudali","Meriem",        "meriem.boudali@email.dz", res_pwd,  "5A",  2,"+213 770 987 654","resident"),
            (1,"Benali", "Riad",          "riad.benali@email.dz",    res_pwd,  "2B",  1,"+213 555 456 789","resident"),
            (2,"Hamidi", "Sonia",         "sonia.hamidi@email.dz",   res_pwd,  "4D",  2,"+213 661 112 233","resident"),
            (2,"Mansouri","Youssef",      "youssef.mans@email.dz",   res_pwd,  "3A",  1,"+213 662 334 455","resident"),
            (3,"Amrani", "Fatima",        "fatima.amrani@email.dz",  res_pwd,  "6B",  3,"+213 663 445 566","resident"),
            (4,"Bensalem","Nacer",        "nacer.bens@email.dz",     res_pwd,  "1C",  0,"+213 664 556 677","resident"),
            (1,"Zerrouki","Leila",        "leila.zerr@email.dz",     res_pwd,  "8D",  4,"+213 665 667 788","resident"),
            (2,"Bouabdallah","Omar",      "omar.bouab@email.dz",     res_pwd,  "5E",  2,"+213 666 778 899","resident"),
            (3,"Khaled", "Nabil",         "nabil.khaled@email.dz",   res_pwd,  "2F",  1,"+213 667 889 900","resident"),
            (4,"Sellami","Sarah",         "sarah.sell@email.dz",     res_pwd,  "7G",  3,"+213 668 990 011","resident"),
        ]
    )

    c.executemany(
        "INSERT INTO charges (resident_id,designation,montant_total,montant_restant,echeance,statut,date_paiement) VALUES (?,?,?,?,?,?,?)",
        [
            (2,"Charges de copropriete - Avril 2026",15000.00,15000.00,"2026-04-30","en_attente",None),
            (2,"Charges de copropriete - Mars 2026", 15000.00,0.00,    "2026-03-31","paye",      "2026-03-01"),
            (3,"Charges de copropriete - Avril 2026",15000.00,8000.00, "2026-04-30","partiel",   None),
            (4,"Charges de copropriete - Avril 2026",15000.00,15000.00,"2026-04-30","en_attente",None),
            (5,"Charges de copropriete - Avril 2026",15000.00,0.00,    "2026-04-30","paye",      "2026-04-02"),
            (6,"Charges de copropriete - Avril 2026",15000.00,15000.00,"2026-04-30","en_attente",None),
            (7,"Charges de copropriete - Avril 2026",15000.00,5000.00, "2026-04-30","partiel",   None),
            (8,"Charges de copropriete - Avril 2026",15000.00,0.00,    "2026-04-30","paye",      "2026-04-05"),
            (9,"Charges de copropriete - Avril 2026",15000.00,15000.00,"2026-04-30","en_attente",None),
            (10,"Charges de copropriete - Avril 2026",15000.00,12000.00,"2026-04-30","partiel",   None),
            (11,"Charges de copropriete - Avril 2026",15000.00,0.00,    "2026-04-30","paye",      "2026-04-01"),
            (12,"Charges de copropriete - Avril 2026",15000.00,15000.00,"2026-04-30","en_attente",None),
            (2,"Charges de copropriete - Mai 2026",15000.00,15000.00,"2026-05-31","en_attente",None),
            (4,"Charges de copropriete - Mai 2026",15000.00,15000.00,"2026-05-31","en_attente",None),
        ]
    )

    c.executemany(
        "INSERT INTO alertes (titre,contenu,type_alerte,auteur_id,date_creation) VALUES (?,?,?,?,?)",
        [
            ("Coupure d'eau - Dimanche 20 Avr, 09h-14h",
             "Des travaux de maintenance sur le reseau principal necessiteront une coupure d'eau. Veuillez stockere de l'eau en avance.",
             "attention",1,"2026-04-14 08:00:00"),
            ("Inspection gaz Sonelgaz - Vendredi 19 Avr",
             "Des techniciens de Sonelgaz interviendront dans tous les appartements. Merci de rester disponible ou de deposer vos cles chez le gardien.",
             "danger",1,"2026-04-13 10:00:00"),
            ("Maintenance Ascenseur A - Mercredi 16 Avr",
             "L'ascenseur A sera en arret de 9h a 11h. L'ascenseur B reste operationnel.",
             "info",1,"2026-04-12 09:00:00"),
            ("Salle commune ouverte",
             "Les travaux sont termines. L'espace est a nouveau accessible a tous les residents.",
             "succes",1,"2026-04-15 14:00:00"),
        ]
    )

    c.executemany(
        "INSERT INTO requetes (resident_id,sujet,contenu,statut,reponse,date_reponse) VALUES (?,?,?,?,?,?)",
        [
            (2,"Nuisances sonores - Appartement 3A",
             "De la musique forte apres 23h en semaine depuis deux semaines.",
             "resolu","Nous avons contacte le resident du 3A et l'avons averti formellement.","2026-04-13 10:00:00"),
            (3,"Probleme canalisation salle de bain",
             "Il y a une fuite au niveau de la canalisation sous le lavabo depuis 3 jours.",
             "en_attente",None,None),
        ]
    )

    c.executemany(
        "INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
        [
            (2,"Bienvenue sur INNOVA","Votre espace resident INNOVIM est pret.","info"),
            (2,"Charge disponible","Vos charges d'Avril 2026 sont disponibles : 15 000 DA.","charge"),
            (3,"Paiement partiel recu","Paiement de 7 000 DA enregistre. Reste : 8 000 DA.","paiement"),
        ]
    )


class ResidenceDB:
    @staticmethod
    def get_all():
        conn = get_connection()
        rows = conn.execute("SELECT * FROM residences WHERE actif=1 ORDER BY nom").fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def get_by_id(residence_id):
        conn = get_connection()
        row = conn.execute("SELECT * FROM residences WHERE id=?", (residence_id,)).fetchone()
        conn.close()
        return row_to_dict(row)

    @staticmethod
    def create(nom, nom_complet, adresse=""):
        conn = get_connection()
        conn.execute(
            "INSERT INTO residences (nom, nom_complet, adresse) VALUES (?, ?, ?)",
            (nom, nom_complet, adresse)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def seed_default():
        conn = get_connection()
        existing = conn.execute("SELECT COUNT(*) FROM residences").fetchone()[0]
        if existing == 0:
            residences = [
                ("baitek", "Baitek", "Alger"),
                ("baitek2", "Baitek 2", "Alger"),
                ("innovim", "INNOVIM", "Alger"),
                ("innovim2", "INNOVIM 2", "Alger"),
            ]
            conn.executemany(
                "INSERT INTO residences (nom, nom_complet, adresse) VALUES (?, ?, ?)",
                [(*r,) for r in residences]
            )
            conn.commit()
        
        existing_settings = conn.execute("SELECT COUNT(*) FROM settings WHERE cle='montant_mensuel'").fetchone()[0]
        if existing_settings == 0:
            conn.execute("INSERT INTO settings (cle, valeur) VALUES ('montant_mensuel', '15000')")
            conn.commit()
        
        conn.close()


# -- CLASSES METIER ---------------------------------------------------------------

class ResidentDB:
    @staticmethod
    def authenticate(email, password):
        conn = get_connection()
        row = conn.execute("SELECT r.*, res.nom_complet as residence_nom FROM residents r LEFT JOIN residences res ON r.residence_id=res.id WHERE r.email=?", (email,)).fetchone()
        if not row:
            conn.close()
            return None
        resident = row_to_dict(row)
        if not verify_password(password, resident["mot_de_passe"]):
            conn.close()
            return None
        upgrade_password_if_needed(conn, resident["id"], password, resident["mot_de_passe"])
        conn.close()
        return resident

    @staticmethod
    def get_all():
        conn = get_connection()
        rows = conn.execute(
            "SELECT r.id,r.nom,r.prenom,r.unite,r.etage,r.telephone,r.role,r.date_inscription,res.nom_complet as residence_nom FROM residents r LEFT JOIN residences res ON r.residence_id=res.id WHERE r.role!='admin' ORDER BY r.unite"
        ).fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def get_by_id(rid):
        conn = get_connection()
        row = conn.execute("SELECT * FROM residents WHERE id=?", (rid,)).fetchone()
        conn.close()
        return row_to_dict(row)

    @staticmethod
    def create(nom, prenom, email, password, unite, etage, telephone="", residence_id=1):
        nom = nom.strip()
        prenom = prenom.strip()
        email = email.strip().lower()
        unite = unite.strip()
        telephone = telephone.strip()
        if not nom or not prenom or not email or not password or not unite:
            return False, "Tous les champs obligatoires doivent etre remplis"
        if len(password) < 6:
            return False, "Le mot de passe doit contenir au moins 6 caracteres"
        conn = get_connection()
        try:
            conn.execute(
                "INSERT INTO residents (residence_id,nom,prenom,email,mot_de_passe,unite,etage,telephone) VALUES (?,?,?,?,?,?,?,?)",
                (residence_id, nom, prenom, email, hash_password(password), unite, int(etage or 0), telephone)
            )
            conn.commit()
            new_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
            residence = row_to_dict(conn.execute("SELECT nom_complet FROM residences WHERE id=?", (residence_id,)).fetchone())
            residence_nom = residence.get("nom_complet", "INNOVIM") if residence else "INNOVIM"
            conn.execute(
                "INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
                (new_id, "Bienvenue sur BENZAAMIA PROMOTION", f"Bonjour {prenom}, votre compte {residence_nom} est actif.", "info")
            )
            conn.commit()
            return True, "Resident cree avec succes"
        except IntegrityError:
            return False, "Cet email est deja utilise"
        finally:
            conn.close()


class ChargeDB:
    @staticmethod
    def get_by_resident(resident_id):
        conn = get_connection()
        rows = conn.execute("SELECT * FROM charges WHERE resident_id=? ORDER BY echeance DESC", (resident_id,)).fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def get_all_with_residents():
        conn = get_connection()
        rows = conn.execute(
            "SELECT c.*,r.nom||' '||r.prenom AS resident_nom,r.unite FROM charges c JOIN residents r ON c.resident_id=r.id ORDER BY c.echeance DESC"
        ).fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def get_by_id(charge_id):
        conn = get_connection()
        row = conn.execute("SELECT * FROM charges WHERE id=?", (charge_id,)).fetchone()
        conn.close()
        return row_to_dict(row)

    @staticmethod
    def pay_online(charge_id, montant, resident_id):
        conn = get_connection()
        charge = row_to_dict(conn.execute("SELECT * FROM charges WHERE id=?", (charge_id,)).fetchone())
        if not charge:
            conn.close()
            raise ValueError("Charge introuvable")
        if charge["resident_id"] != resident_id:
            conn.close()
            raise PermissionError("Cette charge ne vous appartient pas")
        if charge["statut"] == "paye":
            conn.close()
            raise ValueError("Cette charge est deja reglee")
        if montant > charge["montant_restant"]:
            conn.close()
            raise ValueError(f"Le montant depasse le reste a payer ({charge['montant_restant']} DA)")
        ref = generate_payment_ref("INN", charge_id)
        nouveau_restant = max(0.0, round(charge["montant_restant"] - montant, 2))
        statut = "paye" if nouveau_restant == 0 else "partiel"
        conn.execute("UPDATE charges SET montant_restant=?,statut=?,date_paiement=CURRENT_TIMESTAMP WHERE id=?",
                     (nouveau_restant, statut, charge_id))
        conn.execute("INSERT INTO paiements (charge_id,resident_id,montant,methode,reference) VALUES (?,?,?,?,?)",
                     (charge_id, resident_id, montant, "en_ligne", ref))
        conn.execute("INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
                     (resident_id, "Paiement confirme",
                      f"Paiement de {montant:,.0f} DA confirme. Ref. : {ref}. Reste : {nouveau_restant:,.0f} DA.",
                      "paiement"))
        conn.commit()
        conn.close()
        return ref, nouveau_restant

    @staticmethod
    def pay_admin(charge_id, montant, note=""):
        conn = get_connection()
        charge = row_to_dict(conn.execute("SELECT * FROM charges WHERE id=?", (charge_id,)).fetchone())
        if not charge:
            conn.close()
            raise ValueError("Charge introuvable")
        if charge["statut"] == "paye":
            conn.close()
            raise ValueError("Cette charge est deja reglee")
        if montant > charge["montant_restant"]:
            conn.close()
            raise ValueError(f"Le montant depasse le reste a payer ({charge['montant_restant']} DA)")
        ref = generate_payment_ref("ADM", charge_id)
        nouveau_restant = max(0.0, round(charge["montant_restant"] - montant, 2))
        statut = "paye" if nouveau_restant == 0 else "partiel"
        conn.execute("UPDATE charges SET montant_restant=?,statut=?,date_paiement=CURRENT_TIMESTAMP WHERE id=?",
                     (nouveau_restant, statut, charge_id))
        conn.execute("INSERT INTO paiements (charge_id,resident_id,montant,methode,reference,note) VALUES (?,?,?,?,?,?)",
                     (charge_id, charge["resident_id"], montant, "administration", ref, note))
        conn.execute("INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
                     (charge["resident_id"], "Paiement enregistre par l'administration",
                      f"Paiement de {montant:,.0f} DA enregistre a la reception. Ref. : {ref}. Reste : {nouveau_restant:,.0f} DA.",
                      "paiement"))
        
        # Send push notification for payment
        from app import send_push_notification, DeviceTokenDB
        all_tokens = DeviceTokenDB.get_all()
        for token_info in all_tokens:
            if token_info['resident_id'] == charge['resident_id']:
                send_push_notification(
                    token_info['expo_token'],
                    "Paiement confirme",
                    f"Votre paiement de {montant:,.0f} DA a ete enregistre. Ref: {ref}. Reste: {nouveau_restant:,.0f} DA.",
                    {"type": "paiement"}
                )
                break
        
        # Message prive automatique
        admin = row_to_dict(conn.execute("SELECT id FROM residents WHERE role='admin' LIMIT 1").fetchone())
        if admin:
            canal = f"prive_{min(admin['id'], charge['resident_id'])}_{max(admin['id'], charge['resident_id'])}"
            conn.execute("INSERT INTO messages (expediteur_id,destinataire_id,canal,contenu) VALUES (?,?,?,?)",
                         (admin["id"], charge["resident_id"], canal,
                          f"Bonjour, nous confirmons la reception de votre paiement de {montant:,.0f} DA. Reference : {ref}. Reste du : {nouveau_restant:,.0f} DA. Merci."))
        conn.commit()
        conn.close()
        return ref, nouveau_restant

    @staticmethod
    def create(resident_id, designation, montant, echeance):
        designation = designation.strip()
        if not designation or montant <= 0 or not echeance:
            raise ValueError("Donnees de charge invalides")
        conn = get_connection()
        # Verify resident exists
        res = conn.execute("SELECT id FROM residents WHERE id=?", (resident_id,)).fetchone()
        if not res:
            conn.close()
            raise ValueError("Resident introuvable")
        conn.execute("INSERT INTO charges (resident_id,designation,montant_total,montant_restant,echeance) VALUES (?,?,?,?,?)",
                     (resident_id, designation, montant, montant, echeance))
        conn.commit()
        conn.execute("INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
                     (resident_id, "Nouvelle charge",
                      f"'{designation}' - {montant:,.0f} DA. Echeance : {echeance}.", "charge"))
        conn.commit()
        conn.close()

    @staticmethod
    def get_paiements(charge_id):
        conn = get_connection()
        rows = conn.execute("SELECT * FROM paiements WHERE charge_id=? ORDER BY date_paiement DESC", (charge_id,)).fetchall()
        conn.close()
        return rows_to_list(rows)


class MessageDB:
    @staticmethod
    def get_private(resident_id, admin_id):
        canal = f"prive_{min(resident_id, admin_id)}_{max(resident_id, admin_id)}"
        conn = get_connection()
        rows = conn.execute(
            "SELECT m.*,r.nom||' '||r.prenom AS expediteur_nom,r.unite,r.role FROM messages m JOIN residents r ON m.expediteur_id=r.id WHERE m.canal=? ORDER BY m.date_envoi ASC",
            (canal,)
        ).fetchall()
        conn.execute("UPDATE messages SET lu=1 WHERE canal=? AND expediteur_id!=?", (canal, resident_id))
        conn.commit()
        conn.close()
        return rows_to_list(rows), canal

    @staticmethod
    def get_community():
        conn = get_connection()
        rows = conn.execute(
            "SELECT m.*,r.nom||' '||r.prenom AS expediteur_nom,r.unite,r.role FROM messages m JOIN residents r ON m.expediteur_id=r.id WHERE m.canal='communaute' ORDER BY m.date_envoi ASC"
        ).fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def send(expediteur_id, canal, contenu, destinataire_id=None):
        contenu = contenu.strip()
        if not contenu:
            raise ValueError("Le message ne peut pas etre vide")
        if len(contenu) > 2000:
            raise ValueError("Message trop long (2000 caracteres max)")
        conn = get_connection()
        conn.execute("INSERT INTO messages (expediteur_id,destinataire_id,canal,contenu) VALUES (?,?,?,?)",
                     (expediteur_id, destinataire_id, canal, contenu))
        conn.commit()
        msg_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        row = conn.execute(
            "SELECT m.*,r.nom||' '||r.prenom AS expediteur_nom,r.unite,r.role FROM messages m JOIN residents r ON m.expediteur_id=r.id WHERE m.id=?",
            (msg_id,)
        ).fetchone()
        if destinataire_id:
            exp = row_to_dict(conn.execute("SELECT nom,prenom FROM residents WHERE id=?", (expediteur_id,)).fetchone())
            conn.execute("INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
                         (destinataire_id, f"Message de {exp['prenom']} {exp['nom']}",
                          contenu[:80] + ("..." if len(contenu) > 80 else ""), "message"))
            conn.commit()
        conn.close()
        return row_to_dict(row)

    @staticmethod
    def unread_count(resident_id):
        conn = get_connection()
        count = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE lu=0 AND expediteur_id!=? AND (destinataire_id=? OR canal='communaute')",
            (resident_id, resident_id)
        ).fetchone()[0]
        conn.close()
        return count

    @staticmethod
    def get_conversations_admin():
        conn = get_connection()
        admin = row_to_dict(conn.execute("SELECT id FROM residents WHERE role='admin' LIMIT 1").fetchone())
        if not admin:
            conn.close()
            return []
        admin_id = admin["id"]

        # Use a simpler, correct query
        residents = conn.execute(
            "SELECT id, nom, prenom, unite FROM residents WHERE role='resident' ORDER BY nom"
        ).fetchall()

        result = []
        for r in residents:
            rid = r["id"]
            canal = f"prive_{min(rid, admin_id)}_{max(rid, admin_id)}"
            non_lus = conn.execute(
                "SELECT COUNT(*) FROM messages WHERE canal=? AND lu=0 AND expediteur_id=?",
                (canal, rid)
            ).fetchone()[0]
            dernier = conn.execute(
                "SELECT contenu, date_envoi FROM messages WHERE canal=? ORDER BY date_envoi DESC LIMIT 1",
                (canal,)
            ).fetchone()
            result.append({
                "id": rid,
                "nom": r["nom"],
                "prenom": r["prenom"],
                "unite": r["unite"],
                "non_lus": non_lus,
                "dernier_message": dernier["contenu"] if dernier else None,
                "derniere_date": dernier["date_envoi"] if dernier else None,
            })

        # Sort: newest message at top (unread AND recent come first)
        result.sort(key=lambda x: (
            -(x["non_lus"] or 0),  # Unread first
            x["derniere_date"] or ""  # Most recent first
        ), reverse=True)
        result.sort(key=lambda x: (-(x["non_lus"] or 0), -(x["derniere_date"] or "").__hash__()))
        # Simpler: unread first, then recent first
        result.sort(key=lambda x: (0 if x["non_lus"] > 0 else 1, x["derniere_date"] or ""), reverse=False)
        result.sort(key=lambda x: (0 if x["non_lus"] > 0 else 1,))

        # Final sort: unread desc, then date desc
        def sort_key(x):
            has_unread = 0 if x["non_lus"] > 0 else 1
            date = x["derniere_date"] or ""
            return (has_unread, date)

        result.sort(key=sort_key)
        # Reverse date within groups
        unread = [x for x in result if x["non_lus"] > 0]
        read = [x for x in result if x["non_lus"] == 0]
        unread.sort(key=lambda x: x["derniere_date"] or "", reverse=True)
        read.sort(key=lambda x: x["derniere_date"] or "", reverse=True)
        result = unread + read

        conn.close()
        return result

    @staticmethod
    def total_unread_admin():
        conn = get_connection()
        admin = row_to_dict(conn.execute("SELECT id FROM residents WHERE role='admin' LIMIT 1").fetchone())
        if not admin:
            conn.close()
            return 0
        count = conn.execute(
            "SELECT COUNT(*) FROM messages WHERE lu=0 AND destinataire_id=?",
            (admin["id"],)
        ).fetchone()[0]
        conn.close()
        return count


class AlerteDB:
    @staticmethod
    def get_active(residence_id=None):
        conn = get_connection()
        if residence_id:
            rows = conn.execute(
                "SELECT a.*,r.nom||' '||r.prenom AS auteur_nom FROM alertes a JOIN residents r ON a.auteur_id=r.id WHERE a.active=1 AND (a.residence_id=? OR a.residence_id IS NULL) ORDER BY a.date_creation DESC",
                (residence_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT a.*,r.nom||' '||r.prenom AS auteur_nom FROM alertes a JOIN residents r ON a.auteur_id=r.id WHERE a.active=1 ORDER BY a.date_creation DESC"
            ).fetchall()
        conn.close()
        return rows_to_list(rows)
    
    @staticmethod
    def get_history():
        conn = get_connection()
        rows = conn.execute(
            "SELECT a.*,r.nom||' '||r.prenom AS auteur_nom FROM alertes a JOIN residents r ON a.auteur_id=r.id WHERE a.active=0 ORDER BY a.date_creation DESC"
        ).fetchall()
        conn.close()
        return rows_to_list(rows)
    
    @staticmethod
    def archiver(alerte_id):
        conn = get_connection()
        conn.execute("UPDATE alertes SET active=0 WHERE id=?", (alerte_id,))
        conn.commit()
        conn.close()
    
    @staticmethod
    def hard_delete(alerte_id):
        conn = get_connection()
        conn.execute("DELETE FROM alertes WHERE id=?", (alerte_id,))
        conn.commit()
        conn.close()

    @staticmethod
    def count_unread(resident_id):
        conn = get_connection()
        row = conn.execute(
            "SELECT COUNT(*) FROM alertes_vues WHERE resident_id=?",
            (resident_id,)
        ).fetchone()
        total = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=1").fetchone()
        count = (total[0] or 0) - (row[0] or 0) if row and total else 0
        conn.close()
        return count

    @staticmethod
    def mark_all_read(resident_id):
        conn = get_connection()
        conn.execute(
            "INSERT OR IGNORE INTO alertes_vues (resident_id, alerte_id) SELECT ?, id FROM alertes WHERE active=1",
            (resident_id,)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def create(titre, contenu, type_alerte, auteur_id, residence_id=None):
        titre = titre.strip()
        contenu = contenu.strip()
        if not titre or not contenu:
            raise ValueError("Titre et contenu requis")
        valid_types = ("info", "attention", "danger", "succes")
        if type_alerte not in valid_types:
            type_alerte = "info"
        conn = get_connection()
        conn.execute("INSERT INTO alertes (titre,contenu,type_alerte,auteur_id,residence_id) VALUES (?,?,?,?,?)",
                     (titre, contenu, type_alerte, auteur_id, residence_id))
        
        if residence_id:
            residents = conn.execute("SELECT id FROM residents WHERE role='resident' AND residence_id=?", (residence_id,)).fetchall()
        else:
            residents = conn.execute("SELECT id FROM residents WHERE role='resident'").fetchall()
        
        for r in residents:
            conn.execute("INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
                         (r[0], f"Alerte : {titre}", contenu[:100], type_alerte))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(alerte_id):
        conn = get_connection()
        conn.execute("UPDATE alertes SET active=0 WHERE id=?", (alerte_id,))
        conn.commit()
        conn.close()


class RequeteDB:
    @staticmethod
    def get_by_resident(resident_id):
        conn = get_connection()
        rows = conn.execute("SELECT * FROM requetes WHERE resident_id=? ORDER BY date_creation DESC", (resident_id,)).fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def get_all():
        conn = get_connection()
        rows = conn.execute(
            "SELECT q.*,r.nom||' '||r.prenom AS resident_nom,r.unite FROM requetes q JOIN residents r ON q.resident_id=r.id ORDER BY q.date_creation DESC"
        ).fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def create(resident_id, sujet, contenu):
        sujet = sujet.strip()
        contenu = contenu.strip()
        if not sujet or not contenu:
            raise ValueError("Sujet et contenu requis")
        conn = get_connection()
        conn.execute("INSERT INTO requetes (resident_id,sujet,contenu) VALUES (?,?,?)", (resident_id, sujet, contenu))
        conn.commit()
        conn.close()

    @staticmethod
    def reply(requete_id, reponse):
        reponse = reponse.strip()
        if not reponse:
            raise ValueError("La reponse ne peut pas etre vide")
        conn = get_connection()
        req = row_to_dict(conn.execute("SELECT * FROM requetes WHERE id=?", (requete_id,)).fetchone())
        if not req:
            conn.close()
            raise ValueError("Requete introuvable")
        conn.execute("UPDATE requetes SET statut='resolu',reponse=?,date_reponse=CURRENT_TIMESTAMP WHERE id=?",
                     (reponse, requete_id))
        conn.execute("INSERT INTO notifications (resident_id,titre,contenu,type_notif) VALUES (?,?,?,?)",
                     (req["resident_id"], "Reponse a votre requete",
                      f"Reponse recue pour : '{req['sujet']}'.", "requete"))
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_history():
        conn = get_connection()
        rows = conn.execute(
            "SELECT q.*,r.nom||' '||r.prenom AS resident_nom,r.unite FROM requetes q JOIN residents r ON q.resident_id=r.id WHERE q.statut='resolu' ORDER BY q.date_creation DESC"
        ).fetchall()
        conn.close()
        return rows_to_list(rows)
    
    @staticmethod
    def delete(requete_id):
        conn = get_connection()
        conn.execute("DELETE FROM requetes WHERE id=?", (requete_id,))
        conn.commit()
        conn.close()
        conn.commit()
        conn.close()

    @staticmethod
    def count_en_attente():
        conn = get_connection()
        count = conn.execute("SELECT COUNT(*) FROM requetes WHERE statut='en_attente'").fetchone()[0]
        conn.close()
        return count


class NotificationDB:
    @staticmethod
    def get_by_resident(resident_id):
        conn = get_connection()
        rows = conn.execute(
            "SELECT * FROM notifications WHERE resident_id=? ORDER BY date_creation DESC LIMIT 30",
            (resident_id,)
        ).fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def count_unread(resident_id):
        conn = get_connection()
        count = conn.execute("SELECT COUNT(*) FROM notifications WHERE resident_id=? AND lu=0", (resident_id,)).fetchone()[0]
        conn.close()
        return count

    @staticmethod
    def mark_all_read(resident_id):
        conn = get_connection()
        conn.execute("UPDATE notifications SET lu=1 WHERE resident_id=?", (resident_id,))
        conn.commit()
        conn.close()

    @staticmethod
    def create(resident_id, titre, contenu, type_notif='info'):
        conn = get_connection()
        conn.execute(
            "INSERT INTO notifications (resident_id, titre, contenu, type_notif) VALUES (?, ?, ?, ?)",
            (resident_id, titre, contenu, type_notif)
        )
        conn.commit()
        conn.close()


class DeviceTokenDB:
    @staticmethod
    def save_or_update(resident_id, expo_token, type_app='mobile'):
        conn = get_connection()
        existing = conn.execute(
            "SELECT id FROM device_tokens WHERE resident_id=? AND expo_token=?",
            (resident_id, expo_token)
        ).fetchone()
        
        if existing:
            conn.close()
            return
        
        conn.execute(
            "INSERT INTO device_tokens (resident_id, expo_token, type_app) VALUES (?, ?, ?)",
            (resident_id, expo_token, type_app)
        )
        conn.commit()
        conn.close()

    @staticmethod
    def get_all_for_resident(resident_id):
        conn = get_connection()
        rows = conn.execute(
            "SELECT expo_token FROM device_tokens WHERE resident_id=?",
            (resident_id,)
        ).fetchall()
        conn.close()
        return [r['expo_token'] for r in rows]

    @staticmethod
    def get_all():
        conn = get_connection()
        rows = conn.execute("SELECT DISTINCT resident_id, expo_token FROM device_tokens").fetchall()
        conn.close()
        return rows_to_list(rows)

    @staticmethod
    def delete(resident_id, expo_token):
        conn = get_connection()
        conn.execute(
            "DELETE FROM device_tokens WHERE resident_id=? AND expo_token=?",
            (resident_id, expo_token)
        )
        conn.commit()
        conn.close()


class SettingsDB:
    @staticmethod
    def get(cle, default=None):
        conn = get_connection()
        row = conn.execute("SELECT valeur FROM settings WHERE cle=?", (cle,)).fetchone()
        conn.close()
        return row['valeur'] if row else default
    
    @staticmethod
    def set(cle, valeur):
        conn = get_connection()
        conn.execute("INSERT OR REPLACE INTO settings (cle, valeur) VALUES (?, ?)", (cle, str(valeur)))
        conn.commit()
        conn.close()
    
    @staticmethod
    def get_montant_mensuel():
        val = SettingsDB.get('montant_mensuel', '15000')
        try:
            return float(val)
        except:
            return 15000.0
    
    @staticmethod
    def set_montant_mensuel(montant):
        SettingsDB.set('montant_mensuel', str(montant))
    
    @staticmethod
    def generer_charges_mensuelles():
        from datetime import datetime
        maintenant = datetime.now()
        mois_en_cours = maintenant.strftime('%Y-%m')
        mois_nom = maintenant.strftime('%B %Y').capitalize()
        
        conn = get_connection()
        
        existing = conn.execute(
            "SELECT id FROM charges WHERE designation LIKE ?",
            (f'%{mois_nom}%',)
        ).fetchone()
        if existing:
            conn.close()
            return {"succes": False, "message": "Charges déjà générées pour ce mois"}
        
        residents = conn.execute("SELECT id, nom, prenom FROM residents WHERE role='resident'").fetchall()
        montant = SettingsDB.get_montant_mensuel()
        
        jour_echeance = 30 if maintenant.month != 2 else 28
        echeance = f"{maintenant.year}-{maintenant.month:02d}-{min(jour_echeance, 28):02d}"
        
        count = 0
        for r in residents:
            conn.execute(
                "INSERT INTO charges (resident_id, designation, montant_total, montant_restant, echeance) VALUES (?,?,?,?,?)",
                (r['id'], f"Charges de copropriete - {mois_nom}", montant, montant, echeance)
            )
            conn.execute(
                "INSERT INTO notifications (resident_id, titre, contenu, type_notif) VALUES (?,?,?,?)",
                (r['id'], "Nouvelle charge", f"Vos charges de {mois_nom} sont disponibles : {montant:,.0f} DA.", "charge")
            )
            count += 1
        
        conn.commit()
        conn.close()
        
        return {"succes": True, "count": count, "message": f"{count} charges générées pour {mois_nom}"}

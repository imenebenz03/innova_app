"""
INNOVA — Residence INNOVIM (Algerie)
Backend Flask — API REST
"""

import os
import re
import secrets
from flask import Flask, request, jsonify, session, make_response
from functools import wraps
from database import (
    init_db,
    ResidentDB, ChargeDB, MessageDB,
    AlerteDB, RequeteDB, NotificationDB, DeviceTokenDB,
    ResidenceDB, get_connection, row_to_dict, rows_to_list
)

app = Flask(__name__)
app.secret_key = os.environ.get("INNOVA_SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_COOKIE_SAMESITE"] = "None"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = True
app.config["PERMANENT_SESSION_LIFETIME"] = 3600  # 1 hour


@app.after_request
def add_cors(response):
    origin = request.headers.get("Origin", "")

    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://192.168.137.1:8081",
        "http://192.168.137.1:19000",
        "http://192.168.137.1:19001",
        "exp://192.168.137.1:19000",
    ]

    allowed_origins += os.environ.get("CORS_ORIGINS", "").split(",")

    def origin_allowed(o):
        if o in allowed_origins:
            return True
        if re.match(r'^https://innova-[\w-]+-imenebenz-s-projects1\.vercel\.app$', o):
            return True
        return False

    if origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Cookie"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

@app.route("/api/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    return make_response("", 204)


# -- DECORATEURS ---------------------------------------------------------------

STAFF_ROLES = ("super_admin", "operations", "finance", "admin")
PAYMENT_METHODS = {"cash", "bank_card", "bank_transfer", "cheque"}
TOTAL_APARTMENTS = int(os.environ.get("INNOVA_TOTAL_APARTMENTS", "200"))

def _normalize_role(role):
    return "super_admin" if role == "admin" else role

def login_requis(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "resident_id" not in session:
            return jsonify({"erreur": "Non authentifie"}), 401
        return f(*args, **kwargs)
    return decorated

def staff_requis(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "resident_id" not in session:
            return jsonify({"erreur": "Non authentifie"}), 401
        role = _normalize_role(session.get("role", ""))
        if role not in STAFF_ROLES:
            return jsonify({"erreur": "Acces reserve au personnel"}), 403
        return f(*args, **kwargs)
    return decorated

def role_requis(*roles):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if "resident_id" not in session:
                return jsonify({"erreur": "Non authentifie"}), 401
            role = _normalize_role(session.get("role", ""))
            if role not in roles:
                return jsonify({"erreur": "Acces non autorise"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator


# -- AUTH ----------------------------------------------------------------------

@app.route("/api/auth/connexion", methods=["POST"])
def connexion():
    data = request.get_json()
    if not data:
        return jsonify({"succes": False, "message": "Donnees manquantes"}), 400
    email = data.get("email", "").strip().lower()
    mdp = data.get("mot_de_passe", "")
    print(f"Login attempt: {email}")
    if not email or not mdp:
        return jsonify({"succes": False, "message": "Email et mot de passe requis"}), 400
    resident = ResidentDB.authenticate(email, mdp)
    if not resident:
        print(f"Login failed for: {email}")
        return jsonify({"succes": False, "message": "Email ou mot de passe incorrect"}), 401
    session.permanent = True
    session["resident_id"] = resident["id"]
    session["role"] = resident["role"]
    print(f"Login success: {email} - role: {resident['role']}")
    resident.pop("mot_de_passe", None)
    return jsonify({"succes": True, "resident": resident})

@app.route("/api/auth/inscription", methods=["POST"])
def inscription():
    d = request.get_json()
    if not d:
        return jsonify({"succes": False, "message": "Donnees manquantes"}), 400
    residence_id = d.get("residence_id")
    if not residence_id:
        return jsonify({"succes": False, "message": "Résidence requise"}), 400
    ok, msg = ResidentDB.create(
        d.get("nom", ""), d.get("prenom", ""), d.get("email", ""),
        d.get("mot_de_passe", ""), d.get("unite", ""), d.get("etage", 0),
        d.get("telephone", ""), int(residence_id)
    )
    return jsonify({"succes": ok, "message": msg}), (201 if ok else 400)

@app.route("/api/auth/deconnexion", methods=["POST"])
def deconnexion():
    session.clear()
    return jsonify({"succes": True})

@app.route("/api/auth/moi", methods=["GET"])
@login_requis
def qui_suis_je():
    return jsonify({"resident_id": session["resident_id"], "role": session["role"]})

@app.route("/api/auth/profil", methods=["GET"])
@login_requis
def profil():
    rid = session["resident_id"]
    conn = get_connection()
    row = conn.execute("SELECT r.*, res.nom_complet as residence_nom FROM residents r LEFT JOIN residences res ON r.residence_id=res.id WHERE r.id=?", (rid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"erreur": "Introuvable"}), 404
    resident = row_to_dict(row)
    resident.pop("mot_de_passe", None)
    return jsonify(resident)


# -- RESIDENTS -----------------------------------------------------------------

@app.route("/api/residents", methods=["GET"])
@staff_requis
def get_residents():
    return jsonify(ResidentDB.get_all())

@app.route("/api/residents", methods=["POST"])
@role_requis("super_admin")
def creer_resident():
    d = request.get_json()
    if not d:
        return jsonify({"succes": False, "message": "Donnees manquantes"}), 400
    ok, msg = ResidentDB.create(
        d.get("nom", ""), d.get("prenom", ""), d.get("email", ""),
        d.get("mot_de_passe", ""), d.get("unite", ""), d.get("etage", 0),
        d.get("telephone", "")
    )
    return jsonify({"succes": ok, "message": msg}), (201 if ok else 400)

@app.route("/api/residents/archives", methods=["GET"])
@staff_requis
def get_archived_residents():
    return jsonify(ResidentDB.get_archived())

@app.route("/api/residents/<int:rid>", methods=["GET"])
@staff_requis
def get_resident(rid):
    conn = get_connection()
    row = conn.execute("SELECT r.id,r.nom,r.prenom,r.unite,r.etage,r.telephone,r.email,r.role,r.date_inscription,res.nom_complet as residence_nom FROM residents r LEFT JOIN residences res ON r.residence_id=res.id WHERE r.id=?", (rid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"erreur": "Resident introuvable"}), 404
    return jsonify(row_to_dict(row))

@app.route("/api/residents/<int:rid>/archiver", methods=["POST"])
@role_requis("super_admin", "operations")
def archiver_resident(rid):
    ResidentDB.archive(rid)
    return jsonify({"succes": True, "message": "Résident archivé"})

@app.route("/api/residents/<int:rid>/desarchiver", methods=["POST"])
@role_requis("super_admin", "operations")
def desarchiver_resident(rid):
    ResidentDB.unarchive(rid)
    return jsonify({"succes": True, "message": "Résident restauré"})

@app.route("/api/residents/<int:rid>/finances", methods=["GET"])
@role_requis("super_admin", "finance")
def get_resident_finances(rid):
    conn = get_connection()
    total = conn.execute("SELECT COALESCE(SUM(montant_total),0) FROM charges WHERE resident_id=?", (rid,)).fetchone()[0]
    paye = conn.execute("SELECT COALESCE(SUM(p.montant),0) FROM paiements p JOIN charges c ON p.charge_id=c.id WHERE c.resident_id=?", (rid,)).fetchone()[0]
    conn.close()
    return jsonify({"total_charges": float(total), "total_paid": float(paye), "remaining": round(float(total) - float(paye), 2)})

@app.route("/api/paiements", methods=["GET"])
@login_requis
def get_paiements():
    resident_id = request.args.get("resident_id", type=int)
    conn = get_connection()
    sql = """SELECT p.*, c.designation, c.montant_total, c.echeance
             FROM paiements p JOIN charges c ON p.charge_id=c.id"""
    params = ()
    if resident_id:
        sql += " WHERE p.resident_id=? ORDER BY p.date_paiement DESC"
        params = (resident_id,)
    else:
        sql += " ORDER BY p.date_paiement DESC LIMIT 50"
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return jsonify(rows_to_list(rows))


# -- CHARGES -------------------------------------------------------------------

@app.route("/api/charges", methods=["GET"])
@login_requis
def get_charges():
    rid = int(request.args.get("resident_id", session["resident_id"]))
    if _normalize_role(session.get("role", "")) not in STAFF_ROLES:
        rid = session["resident_id"]
    return jsonify(ChargeDB.get_by_resident(rid))

@app.route("/api/charges/toutes", methods=["GET"])
@role_requis("super_admin", "finance")
def get_toutes_charges():
    return jsonify(ChargeDB.get_all_with_residents())

@app.route("/api/charges", methods=["POST"])
@role_requis("super_admin", "finance")
def creer_charge():
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    try:
        montant = float(d.get("montant", 0))
        if montant <= 0:
            return jsonify({"erreur": "Montant invalide"}), 400
        ChargeDB.create(int(d["resident_id"]), d["designation"], montant, d["echeance"])
        return jsonify({"succes": True}), 201
    except (ValueError, KeyError) as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/settings/montant-mensuel", methods=["GET"])
@role_requis("super_admin", "finance")
def get_montant_mensuel():
    from database import SettingsDB
    return jsonify({"montant": SettingsDB.get_montant_mensuel()})

@app.route("/api/settings/montant-mensuel", methods=["POST"])
@role_requis("super_admin")
def set_montant_mensuel():
    from database import SettingsDB
    d = request.get_json()
    if not d or "montant" not in d:
        return jsonify({"erreur": "Montant manquant"}), 400
    try:
        montant = float(d["montant"])
        if montant <= 0:
            return jsonify({"erreur": "Montant invalide"}), 400
        SettingsDB.set_montant_mensuel(montant)
        return jsonify({"succes": True, "montant": montant})
    except ValueError:
        return jsonify({"erreur": "Montant invalide"}), 400

@app.route("/api/charges/generer-mensuelles", methods=["POST"])
@role_requis("super_admin", "finance")
def generer_charges_mensuelles():
    from database import SettingsDB
    result = SettingsDB.generer_charges_mensuelles()
    return jsonify(result)

@app.route("/api/charges/<int:charge_id>/verifier", methods=["GET"])
@login_requis
def verifier_charge(charge_id):
    """Pre-payment verification: returns charge details for confirmation."""
    charge = ChargeDB.get_by_id(charge_id)
    if not charge:
        return jsonify({"erreur": "Charge introuvable"}), 404
    return jsonify(charge)

@app.route("/api/charges/<int:charge_id>/payer-en-ligne", methods=["POST"])
@login_requis
def payer_en_ligne(charge_id):
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    try:
        montant = float(d.get("montant", 0))
        if montant <= 0:
            return jsonify({"erreur": "Montant invalide"}), 400
        ref, restant = ChargeDB.pay_online(charge_id, montant, session["resident_id"])
        return jsonify({"succes": True, "reference": ref, "montant_restant": restant})
    except PermissionError as e:
        return jsonify({"erreur": str(e)}), 403
    except ValueError as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/charges/<int:charge_id>/payer-admin", methods=["POST"])
@role_requis("super_admin", "finance")
def payer_admin(charge_id):
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    try:
        montant = float(d.get("montant", 0))
        methode = d.get("methode", "").strip()
        if montant <= 0:
            return jsonify({"erreur": "Montant invalide"}), 400
        if methode not in PAYMENT_METHODS:
            return jsonify({"erreur": "Methode de paiement invalide"}), 400
        ref, restant, payment_id = ChargeDB.pay_admin(charge_id, montant, methode)
        return jsonify({"succes": True, "reference": ref, "montant_restant": restant, "paiement_id": payment_id, "methode": methode})
    except ValueError as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/charges/<int:charge_id>/paiements", methods=["GET"])
@login_requis
def get_paiements_charge(charge_id):
    return jsonify(ChargeDB.get_paiements(charge_id))

@app.route("/api/paiements/<int:paiement_id>", methods=["GET"])
@role_requis("super_admin", "finance")
def get_paiement(paiement_id):
    p = ChargeDB.get_paiement_by_id(paiement_id)
    if not p:
        return jsonify({"erreur": "Paiement introuvable"}), 404
    return jsonify(p)

@app.route("/api/paiements/export", methods=["GET"])
@role_requis("super_admin", "finance")
def export_paiements():
    rows = ChargeDB.get_all_for_export()
    return jsonify(rows)


# -- MESSAGES ------------------------------------------------------------------

@app.route("/api/messages/prive", methods=["GET"])
@login_requis
def get_messages_prives():
    from database import get_connection, row_to_dict
    conn = get_connection()
    admin_row = row_to_dict(conn.execute("SELECT id FROM residents WHERE role!='resident' LIMIT 1").fetchone())
    conn.close()
    if not admin_row:
        return jsonify([])
    resident_id = session["resident_id"]
    admin_id = admin_row["id"]
    if _normalize_role(session.get("role", "")) in STAFF_ROLES:
        with_id = int(request.args.get("avec", 0))
        if not with_id:
            return jsonify([])
        msgs, _ = MessageDB.get_private(admin_id, with_id)
    else:
        msgs, _ = MessageDB.get_private(resident_id, admin_id)
    return jsonify(msgs)

@app.route("/api/messages/communaute", methods=["GET"])
@login_requis
def get_messages_communaute():
    return jsonify(MessageDB.get_community())

@app.route("/api/messages/envoyer-prive", methods=["POST"])
@login_requis
def envoyer_prive():
    d = request.get_json()
    if not d or not d.get("contenu", "").strip():
        return jsonify({"erreur": "Message vide"}), 400
    from database import get_connection, row_to_dict
    conn = get_connection()
    admin_row = row_to_dict(conn.execute("SELECT id FROM residents WHERE role!='resident' LIMIT 1").fetchone())
    conn.close()
    if not admin_row:
        return jsonify({"erreur": "Admin introuvable"}), 500
    expediteur_id = session["resident_id"]
    
    resident_info = ResidentDB.get_by_id(expediteur_id)
    sender_name = f"{resident_info.get('prenom', '')} {resident_info.get('nom', '')}"
    
    if _normalize_role(session.get("role", "")) in STAFF_ROLES:
        dest_id = int(d["destinataire_id"])
        dest_resident = ResidentDB.get_by_id(dest_id)
        if dest_resident and dest_resident.get("archived"):
            return jsonify({"erreur": "Ce résident est archivé. Vous ne pouvez plus lui envoyer de messages."}), 403
        canal = f"prive_{min(admin_row['id'], dest_id)}_{max(admin_row['id'], dest_id)}"
        
        dest_tokens = DeviceTokenDB.get_all_for_resident(dest_id)
        for token in dest_tokens:
            send_push_notification(token, f"Nouveau message de l'Administration", d["contenu"][:100], {"type": "message_prive"})
        
        NotificationDB.create(dest_id, "Nouveau message", f"De l'Administration: {d['contenu'][:80]}", "message")
    else:
        dest_id = admin_row["id"]
        canal = f"prive_{min(expediteur_id, admin_row['id'])}_{max(expediteur_id, admin_row['id'])}"
        
        admin_tokens = DeviceTokenDB.get_all_for_resident(dest_id)
        for token in admin_tokens:
            send_push_notification(token, f"Nouveau message de {sender_name}", d["contenu"][:100], {"type": "message_prive"})
        
        NotificationDB.create(dest_id, "Nouveau message", f"Nouveau message de {sender_name}", "message")
    
    try:
        msg = MessageDB.send(expediteur_id, canal, d["contenu"], dest_id)
        return jsonify({"succes": True, "message": msg}), 201
    except ValueError as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/messages/envoyer-communaute", methods=["POST"])
@login_requis
def envoyer_communaute():
    d = request.get_json()
    if not d or not d.get("contenu", "").strip():
        return jsonify({"erreur": "Message vide"}), 400
    
    resident_info = ResidentDB.get_by_id(session["resident_id"])
    sender_name = f"{resident_info.get('prenom', '')} {resident_info.get('nom', '')}"
    
    all_tokens = DeviceTokenDB.get_all()
    for token_info in all_tokens:
        if token_info['resident_id'] != session["resident_id"]:
            send_push_notification(
                token_info['expo_token'], 
                f"Nouveau message communauté", 
                f"{sender_name}: {d['contenu'][:80]}", 
                {"type": "message_communaute"}
            )
    
    try:
        msg = MessageDB.send(session["resident_id"], "communaute", d["contenu"])
        return jsonify({"succes": True, "message": msg}), 201
    except ValueError as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/messages/conversations", methods=["GET"])
@role_requis("super_admin", "operations")
def get_conversations():
    return jsonify(MessageDB.get_conversations_admin())

@app.route("/api/messages/non-lus", methods=["GET"])
@login_requis
def messages_non_lus():
    return jsonify({"count": MessageDB.unread_count(session["resident_id"])})


# -- ALERTES -------------------------------------------------------------------

@app.route("/api/alertes", methods=["GET"])
@login_requis
def get_alertes():
    residence_id = request.args.get("residence_id", type=int)
    try:
        return jsonify(AlerteDB.get_active(residence_id))
    except Exception as e:
        print(f"[get_alertes] ERROR: {e}")
        import traceback; traceback.print_exc()
        return jsonify({"erreur": str(e)}), 500

@app.route("/api/alertes/historique", methods=["GET"])
@role_requis("super_admin", "operations")
def get_alertes_historique():
    return jsonify(AlerteDB.get_history())

@app.route("/api/alertes/<int:alerte_id>/archiver", methods=["POST"])
@role_requis("super_admin", "operations")
def archiver_alerte(alerte_id):
    AlerteDB.archiver(alerte_id)
    return jsonify({"succes": True})

@app.route("/api/alertes/non-lus", methods=["GET"])
@login_requis
def alertes_non_lus():
    return jsonify({"count": AlerteDB.count_unread(session["resident_id"])})

@app.route("/api/alertes/lues", methods=["POST"])
@login_requis
def alertes_marques_lues():
    AlerteDB.mark_all_read(session["resident_id"])
    return jsonify({"succes": True})

@app.route("/api/alertes", methods=["POST"])
@role_requis("super_admin", "operations")
def creer_alerte():
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    
    residence_id = d.get("residence_id")  # None means all residences
    if residence_id in ("", "all", "toutes", None):
        residence_id = None
    else:
        try:
            residence_id = int(residence_id)
        except (TypeError, ValueError):
            return jsonify({"erreur": "Residence invalide"}), 400
    
    type_emoji = {
        "info": "ℹ️",
        "attention": "⚠️",
        "danger": "🚨",
        "succes": "✅"
    }.get(d.get("type_alerte", "info"), "ℹ️")
    
    try:
        AlerteDB.create(d["titre"], d["contenu"], d["type_alerte"], session["resident_id"], residence_id, d.get("epingle", 0), d.get("date_publication"))
        
        all_tokens = DeviceTokenDB.get_all()
        for token_info in all_tokens:
            send_push_notification(
                token_info['expo_token'],
                f"{type_emoji} {d['titre']}",
                d["contenu"][:100],
                {"type": "alerte", "type_alerte": d.get("type_alerte")}
            )
            NotificationDB.create(token_info['resident_id'], d["titre"], d["contenu"][:80], d.get("type_alerte", "info"))
        
        return jsonify({"succes": True}), 201
    except (ValueError, KeyError) as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/alertes/<int:alerte_id>", methods=["DELETE"])
@role_requis("super_admin")
def supprimer_alerte(alerte_id):
    AlerteDB.delete(alerte_id)
    return jsonify({"succes": True})


# -- REQUETES ------------------------------------------------------------------

@app.route("/api/requetes", methods=["GET"])
@login_requis
def get_requetes():
    if _normalize_role(session.get("role", "")) in STAFF_ROLES:
        return jsonify(RequeteDB.get_all())
    return jsonify(RequeteDB.get_by_resident(session["resident_id"]))

@app.route("/api/requetes/historique", methods=["GET"])
@role_requis("super_admin", "operations")
def get_requetes_historique():
    return jsonify(RequeteDB.get_history())

@app.route("/api/requetes/<int:requete_id>", methods=["DELETE"])
@role_requis("super_admin")
def supprimer_requete(requete_id):
    RequeteDB.delete(requete_id)
    return jsonify({"succes": True})

@app.route("/api/requetes/non-lues-admin", methods=["GET"])
@role_requis("super_admin", "operations")
def requetes_non_lues_admin():
    return jsonify({"count": RequeteDB.count_en_attente()})

@app.route("/api/requetes", methods=["POST"])
@login_requis
def creer_requete():
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    try:
        RequeteDB.create(session["resident_id"], d["sujet"], d["contenu"])
        return jsonify({"succes": True}), 201
    except (ValueError, KeyError) as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/requetes/<int:requete_id>/repondre", methods=["POST"])
@role_requis("super_admin", "operations")
def repondre_requete(requete_id):
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    try:
        RequeteDB.reply(requete_id, d["reponse"])
        return jsonify({"succes": True})
    except (ValueError, KeyError) as e:
        return jsonify({"erreur": str(e)}), 400


# -- NOTIFICATIONS -------------------------------------------------------------

@app.route("/api/notifications", methods=["GET"])
@login_requis
def get_notifications():
    return jsonify(NotificationDB.get_by_resident(session["resident_id"]))

@app.route("/api/notifications/count", methods=["GET"])
@login_requis
def count_notifications():
    return jsonify({"count": NotificationDB.count_unread(session["resident_id"])})

@app.route("/api/notifications/lire-tout", methods=["POST"])
@login_requis
def lire_notifications():
    NotificationDB.mark_all_read(session["resident_id"])
    return jsonify({"succes": True})


@app.route("/api/notifications/register-device", methods=["POST"])
@login_requis
def register_device():
    d = request.get_json()
    if not d or not d.get("expo_token"):
        return jsonify({"erreur": "Token Expo requerido"}), 400
    DeviceTokenDB.save_or_update(session["resident_id"], d["expo_token"], d.get("type_app", "mobile"))
    return jsonify({"succes": True})


def send_push_notification(expo_token, title, body, data=None):
    """Send push notification via Expo Push API."""
    try:
        import requests
    except ImportError:
        return False
    
    if not expo_token:
        return False
    
    message = {
        "to": expo_token,
        "title": title,
        "body": body,
        "priority": "high",
    }
    if data:
        message["data"] = data
    
    try:
        response = requests.post(
            "https://exp.host/--/api/v2/push/send",
            json=message,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        return response.status_code == 200
    except Exception:
        return False


# -- SANTE & ADMIN MESSAGES ---------------------------------------------------

@app.route("/api/messages/non-lus-admin", methods=["GET"])
@role_requis("super_admin", "operations")
def messages_non_lus_admin():
    return jsonify({"count": MessageDB.total_unread_admin()})


# -- RESIDENCES ---------------------------------------------------------------

@app.route("/api/residences", methods=["GET"])
@login_requis
def get_residences():
    return jsonify(ResidenceDB.get_all())

@app.route("/api/sante", methods=["GET"])
def sante():
    return jsonify({"statut": "ok", "app": "INNOVA", "pays": "Algerie"})

def ensure_charge_analytics_schema(conn):
    conn.execute("ALTER TABLE charges ADD COLUMN IF NOT EXISTS date_creation TEXT")
    conn.execute("ALTER TABLE charges ALTER COLUMN date_creation SET DEFAULT CURRENT_TIMESTAMP")
    conn.commit()

@app.route("/api/analytics", methods=["GET"])
@role_requis("super_admin")
def analytics():
    conn = get_connection()
    ensure_charge_analytics_schema(conn)
    total_facture = conn.execute("SELECT COALESCE(SUM(montant_total),0) FROM charges").fetchone()[0]
    total_percu = conn.execute("SELECT COALESCE(SUM(montant),0) FROM paiements").fetchone()[0]
    restant = conn.execute("SELECT COALESCE(SUM(montant_restant),0) FROM charges").fetchone()[0]
    taux = round(total_percu / total_facture * 100, 1) if total_facture else 0

    mensuel = conn.execute("""
        SELECT TO_CHAR(date_paiement::timestamp, 'YYYY-MM') AS mois,
               SUM(montant) AS total
        FROM paiements
        WHERE date_paiement::timestamp >= CURRENT_TIMESTAMP - INTERVAL '6 months'
        GROUP BY mois ORDER BY mois
    """).fetchall()
    
    requetes = conn.execute("SELECT statut, COUNT(*) AS count FROM requetes GROUP BY statut").fetchall()
    
    impayes = conn.execute("""
        SELECT res.nom_complet, COALESCE(SUM(c.montant_restant),0) AS total
        FROM charges c JOIN residents r ON c.resident_id=r.id
        JOIN residences res ON r.residence_id=res.id
        WHERE c.statut != 'paye' AND (r.archived IS NULL OR r.archived=0) GROUP BY res.nom_complet ORDER BY total DESC
    """).fetchall()

    mauvais = conn.execute("""
        SELECT r.id, r.nom||' '||r.prenom AS nom, r.unite, res.nom_complet,
               SUM(c.montant_restant) AS total
        FROM charges c JOIN residents r ON c.resident_id=r.id
        JOIN residences res ON r.residence_id=res.id
        WHERE c.statut != 'paye' AND (r.archived IS NULL OR r.archived=0)
        GROUP BY r.id, r.nom, r.prenom, r.unite, res.nom_complet
        ORDER BY total DESC LIMIT 10
    """).fetchall()

    compound_fees = conn.execute("""
        SELECT res.nom_complet, COALESCE(SUM(c.montant_total),0) AS total
        FROM charges c JOIN residents r ON c.resident_id=r.id
        JOIN residences res ON r.residence_id=res.id
        WHERE (r.archived IS NULL OR r.archived=0)
        GROUP BY res.nom_complet ORDER BY total DESC
    """).fetchall()

    monthly_financial_summary = conn.execute("""
        WITH charge_months AS (
            SELECT TO_CHAR(COALESCE(date_creation, echeance)::timestamp, 'YYYY-MM') AS mois,
                   COALESCE(SUM(montant_total),0) AS charges_created,
                   COALESCE(SUM(montant_restant),0) AS remaining_amount
            FROM charges
            WHERE COALESCE(date_creation, echeance)::timestamp >= CURRENT_TIMESTAMP - INTERVAL '6 months'
            GROUP BY mois
        ),
        payment_months AS (
            SELECT TO_CHAR(date_paiement::timestamp, 'YYYY-MM') AS mois,
                   COALESCE(SUM(montant),0) AS amount_collected
            FROM paiements
            WHERE date_paiement::timestamp >= CURRENT_TIMESTAMP - INTERVAL '6 months'
            GROUP BY mois
        )
        SELECT COALESCE(c.mois, p.mois) AS mois,
               COALESCE(c.charges_created,0) AS charges_created,
               COALESCE(p.amount_collected,0) AS amount_collected,
               COALESCE(c.remaining_amount,0) AS remaining_amount,
               CASE WHEN COALESCE(c.charges_created,0) > 0
                    THEN ROUND(((COALESCE(p.amount_collected,0)::numeric / c.charges_created::numeric) * 100), 1)::double precision
                    ELSE 0::double precision END AS collection_percentage
        FROM charge_months c
        FULL OUTER JOIN payment_months p ON c.mois = p.mois
        ORDER BY mois
    """).fetchall()

    occupied_total = conn.execute("SELECT COUNT(DISTINCT unite) FROM residents WHERE role='resident' AND (archived IS NULL OR archived=0)").fetchone()[0]
    occupied_by_compound = conn.execute("""
        SELECT res.nom_complet, COUNT(DISTINCT r.unite) AS count
        FROM residents r JOIN residences res ON r.residence_id=res.id
        WHERE r.role='resident' AND (r.archived IS NULL OR r.archived=0)
        GROUP BY res.nom_complet ORDER BY count DESC
    """).fetchall()

    messages = conn.execute("""
        SELECT date_envoi::date::text AS jour, COUNT(*) AS count
        FROM messages
        WHERE date_envoi::timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
        GROUP BY jour ORDER BY jour
    """).fetchall()

    total_residents = conn.execute("SELECT COUNT(*) FROM residents WHERE role='resident' AND (archived IS NULL OR archived=0)").fetchone()[0]
    total_alertes   = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=1").fetchone()[0]
    alertes_archivees = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=0").fetchone()[0]
    alertes_epinglees = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=1 AND COALESCE(epingle,0)=1").fetchone()[0]
    alertes_programmees = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=1 AND date_publication IS NOT NULL AND date_publication > CURRENT_TIMESTAMP::text").fetchone()[0]
    alertes_par_type = conn.execute("SELECT type_alerte, COUNT(*) AS count FROM alertes GROUP BY type_alerte ORDER BY count DESC").fetchall()
    requetes_ouvertes = conn.execute("SELECT COUNT(*) FROM requetes WHERE statut='en_attente'").fetchone()[0]
    requetes_en_cours = conn.execute("SELECT COUNT(*) FROM requetes WHERE statut='en_cours'").fetchone()[0]
    requetes_resolues = conn.execute("SELECT COUNT(*) FROM requetes WHERE statut='resolu'").fetchone()[0]

    conn.close()
    return jsonify({
        "taux_collecte": taux,
        "total_facture": float(total_facture),
        "total_percu": float(total_percu),
        "remaining": float(restant),
        "mensuel": rows_to_list(mensuel),
        "requetes": rows_to_list(requetes),
        "impayes": rows_to_list(impayes),
        "mauvais_payeurs": rows_to_list(mauvais),
        "compound_fees": rows_to_list(compound_fees),
        "monthly_financial_summary": rows_to_list(monthly_financial_summary),
        "messages_7j": rows_to_list(messages),
        "total_residents": total_residents,
        "occupied_apartments": occupied_total,
        "vacant_apartments": max(TOTAL_APARTMENTS - occupied_total, 0),
        "total_apartments": TOTAL_APARTMENTS,
        "occupied_by_compound": rows_to_list(occupied_by_compound),
        "total_alertes": total_alertes,
        "alertes_archivees": alertes_archivees,
        "alertes_epinglees": alertes_epinglees,
        "alertes_programmees": alertes_programmees,
        "alertes_par_type": rows_to_list(alertes_par_type),
        "requetes_ouvertes": requetes_ouvertes,
        "requetes_en_cours": requetes_en_cours,
        "requetes_resolues": requetes_resolues,
    })


# -- DASHBOARDS (Operations / Finance) ---------------------------------------

@app.route("/api/dashboard/operations", methods=["GET"])
@role_requis("super_admin", "operations")
def dashboard_operations():
    conn = get_connection()
    requetes_ouvertes = conn.execute("SELECT COUNT(*) FROM requetes WHERE statut='en_attente'").fetchone()[0]
    requetes_en_cours = conn.execute("SELECT COUNT(*) FROM requetes WHERE statut='en_cours'").fetchone()[0]
    requetes_resolues = conn.execute("SELECT COUNT(*) FROM requetes WHERE statut='resolu'").fetchone()[0]
    total_residents = conn.execute("SELECT COUNT(*) FROM residents WHERE role='resident' AND (archived IS NULL OR archived=0)").fetchone()[0]
    alertes_recentes = rows_to_list(conn.execute(
        "SELECT id, titre, contenu, date_creation FROM alertes WHERE active=1 ORDER BY date_creation DESC LIMIT 5"
    ).fetchall())
    residents_actifs_7j = conn.execute("""
        SELECT COUNT(DISTINCT expediteur_id) FROM messages
        WHERE date_envoi::timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    """).fetchone()[0]
    alertes_total = conn.execute("SELECT COUNT(*) FROM alertes").fetchone()[0]
    alertes_actives = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=1").fetchone()[0]
    alertes_archivees = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=0").fetchone()[0]
    alertes_epinglees = conn.execute("SELECT COUNT(*) FROM alertes WHERE active=1 AND COALESCE(epingle,0)=1").fetchone()[0]
    alertes_par_type = rows_to_list(conn.execute("SELECT type_alerte, COUNT(*) AS count FROM alertes GROUP BY type_alerte ORDER BY count DESC").fetchall())
    conn.close()
    return jsonify({
        "requetes_ouvertes": requetes_ouvertes,
        "requetes_en_cours": requetes_en_cours,
        "requetes_resolues": requetes_resolues,
        "taux_occupation": round(total_residents / TOTAL_APARTMENTS * 100, 1) if total_residents else 0,
        "alertes_recentes": alertes_recentes,
        "residents_actifs_7j": residents_actifs_7j,
        "alertes_total": alertes_total,
        "alertes_actives": alertes_actives,
        "alertes_archivees": alertes_archivees,
        "alertes_epinglees": alertes_epinglees,
        "alertes_par_type": alertes_par_type,
    })

@app.route("/api/dashboard/finance", methods=["GET"])
@role_requis("super_admin", "finance")
def dashboard_finance():
    conn = get_connection()
    ensure_charge_analytics_schema(conn)
    total_facture = conn.execute("SELECT COALESCE(SUM(montant_total),0) FROM charges").fetchone()[0]
    total_percu   = conn.execute("SELECT COALESCE(SUM(montant),0) FROM paiements").fetchone()[0]
    taux = round(total_percu / total_facture * 100, 1) if total_facture else 0
    impayes_total = total_facture - total_percu

    mensuel = rows_to_list(conn.execute("""
        SELECT TO_CHAR(date_paiement::timestamp, 'YYYY-MM') AS mois,
               SUM(montant) AS total
        FROM paiements
        WHERE date_paiement::timestamp >= CURRENT_TIMESTAMP - INTERVAL '6 months'
        GROUP BY mois ORDER BY mois
    """).fetchall())

    derniers_paiements = rows_to_list(conn.execute("""
        SELECT p.id, p.montant, r.nom||' '||r.prenom AS resident_nom
        FROM paiements p JOIN residents r ON p.resident_id=r.id
        ORDER BY p.date_paiement DESC LIMIT 5
    """).fetchall())

    impayes = rows_to_list(conn.execute("""
        SELECT c.id, r.nom||' '||r.prenom AS resident_nom, r.unite, c.montant_restant
        FROM charges c JOIN residents r ON c.resident_id=r.id
        WHERE c.statut != 'paye' AND (r.archived IS NULL OR r.archived=0) ORDER BY c.montant_restant DESC LIMIT 10
    """).fetchall())

    bad_payers = rows_to_list(conn.execute("""
        SELECT r.id, r.nom||' '||r.prenom AS nom, r.unite, res.nom_complet,
               SUM(c.montant_restant) AS total
        FROM charges c JOIN residents r ON c.resident_id=r.id
        JOIN residences res ON r.residence_id=res.id
        WHERE c.statut != 'paye' AND (r.archived IS NULL OR r.archived=0)
        GROUP BY r.id, r.nom, r.prenom, r.unite, res.nom_complet
        ORDER BY total DESC LIMIT 10
    """).fetchall())

    compound_fees = rows_to_list(conn.execute("""
        SELECT res.nom_complet, COALESCE(SUM(c.montant_total),0) AS total
        FROM charges c JOIN residents r ON c.resident_id=r.id
        JOIN residences res ON r.residence_id=res.id
        WHERE (r.archived IS NULL OR r.archived=0)
        GROUP BY res.nom_complet ORDER BY total DESC
    """).fetchall())

    monthly_financial_summary = rows_to_list(conn.execute("""
        WITH charge_months AS (
            SELECT TO_CHAR(COALESCE(date_creation, echeance)::timestamp, 'YYYY-MM') AS mois,
                   COALESCE(SUM(montant_total),0) AS charges_created,
                   COALESCE(SUM(montant_restant),0) AS remaining_amount
            FROM charges
            WHERE COALESCE(date_creation, echeance)::timestamp >= CURRENT_TIMESTAMP - INTERVAL '6 months'
            GROUP BY mois
        ),
        payment_months AS (
            SELECT TO_CHAR(date_paiement::timestamp, 'YYYY-MM') AS mois,
                   COALESCE(SUM(montant),0) AS amount_collected
            FROM paiements
            WHERE date_paiement::timestamp >= CURRENT_TIMESTAMP - INTERVAL '6 months'
            GROUP BY mois
        )
        SELECT COALESCE(c.mois, p.mois) AS mois,
               COALESCE(c.charges_created,0) AS charges_created,
               COALESCE(p.amount_collected,0) AS amount_collected,
               COALESCE(c.remaining_amount,0) AS remaining_amount,
               CASE WHEN COALESCE(c.charges_created,0) > 0
                    THEN ROUND(((COALESCE(p.amount_collected,0)::numeric / c.charges_created::numeric) * 100), 1)::double precision
                    ELSE 0::double precision END AS collection_percentage
        FROM charge_months c
        FULL OUTER JOIN payment_months p ON c.mois = p.mois
        ORDER BY mois
    """).fetchall())

    conn.close()
    return jsonify({
        "total_facture": float(total_facture),
        "total_collecte": float(total_percu),
        "taux_collecte": taux,
        "impayes_total": float(impayes_total),
        "mensuel": mensuel,
        "derniers_paiements": derniers_paiements,
        "impayes": impayes,
        "bad_payers": bad_payers,
        "compound_fees": compound_fees,
        "monthly_financial_summary": monthly_financial_summary,
    })


if __name__ == "__main__":
    init_db()
    print("""
==========================================================
        INNOVA by INNOVIM -- Backend Flask (Algerie)
==========================================================
  API  : http://localhost:5000/api
  admin@innovim.dz     / admin123
  ahmed.karim@email.dz / resident123
==========================================================
    """)
  

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
    )

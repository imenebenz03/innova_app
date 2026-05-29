"""
INNOVA — Residence INNOVIM (Algerie)
Backend Flask — API REST
"""

import os
import secrets
from flask import Flask, request, jsonify, session, make_response
from functools import wraps
from database import (
    init_db,
    ResidentDB, ChargeDB, MessageDB,
    AlerteDB, RequeteDB, NotificationDB, DeviceTokenDB,
    ResidenceDB, get_connection, row_to_dict
)

app = Flask(__name__)
app.secret_key = os.environ.get("INNOVA_SECRET_KEY", secrets.token_hex(32))
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SECURE"] = os.environ.get("INNOVA_SECURE_COOKIES", "false").lower() == "true"
app.config["PERMANENT_SESSION_LIFETIME"] = 3600  # 1 hour


@app.after_request
def add_cors(response):
    origin = request.headers.get("Origin")

    allowed_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://innova-app-git-main-imenebenz-s-projects1.vercel.app",
        "https://innova-ndxsykp25-imenebenz-s-projects1.vercel.app",
    ]

    if origin in allowed_origins:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"

    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, Cookie"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

@app.route("/api/<path:path>", methods=["OPTIONS"])
def handle_options(path):
    return make_response("", 204)


# -- DECORATEURS ---------------------------------------------------------------

def login_requis(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "resident_id" not in session:
            return jsonify({"erreur": "Non authentifie"}), 401
        return f(*args, **kwargs)
    return decorated

def admin_requis(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "resident_id" not in session:
            return jsonify({"erreur": "Non authentifie"}), 401
        if session.get("role") != "admin":
            return jsonify({"erreur": "Acces reserve a l'administration"}), 403
        return f(*args, **kwargs)
    return decorated


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


# -- RESIDENTS -----------------------------------------------------------------

@app.route("/api/residents", methods=["GET"])
@login_requis
def get_residents():
    return jsonify(ResidentDB.get_all())

@app.route("/api/residents", methods=["POST"])
@admin_requis
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


# -- CHARGES -------------------------------------------------------------------

@app.route("/api/charges", methods=["GET"])
@login_requis
def get_charges():
    rid = int(request.args.get("resident_id", session["resident_id"]))
    if session["role"] != "admin":
        rid = session["resident_id"]
    return jsonify(ChargeDB.get_by_resident(rid))

@app.route("/api/charges/toutes", methods=["GET"])
@admin_requis
def get_toutes_charges():
    return jsonify(ChargeDB.get_all_with_residents())

@app.route("/api/charges", methods=["POST"])
@admin_requis
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
@admin_requis
def get_montant_mensuel():
    from database import SettingsDB
    return jsonify({"montant": SettingsDB.get_montant_mensuel()})

@app.route("/api/settings/montant-mensuel", methods=["POST"])
@admin_requis
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
@admin_requis
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
@admin_requis
def payer_admin(charge_id):
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    try:
        montant = float(d.get("montant", 0))
        note = d.get("note", "").strip()
        if montant <= 0:
            return jsonify({"erreur": "Montant invalide"}), 400
        ref, restant = ChargeDB.pay_admin(charge_id, montant, note)
        return jsonify({"succes": True, "reference": ref, "montant_restant": restant})
    except ValueError as e:
        return jsonify({"erreur": str(e)}), 400

@app.route("/api/charges/<int:charge_id>/paiements", methods=["GET"])
@login_requis
def get_paiements_charge(charge_id):
    return jsonify(ChargeDB.get_paiements(charge_id))


# -- MESSAGES ------------------------------------------------------------------

@app.route("/api/messages/prive", methods=["GET"])
@login_requis
def get_messages_prives():
    from database import get_connection, row_to_dict
    conn = get_connection()
    admin_row = row_to_dict(conn.execute("SELECT id FROM residents WHERE role='admin' LIMIT 1").fetchone())
    conn.close()
    if not admin_row:
        return jsonify([])
    resident_id = session["resident_id"]
    admin_id = admin_row["id"]
    if session["role"] == "admin":
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
    admin_row = row_to_dict(conn.execute("SELECT id FROM residents WHERE role='admin' LIMIT 1").fetchone())
    conn.close()
    if not admin_row:
        return jsonify({"erreur": "Admin introuvable"}), 500
    expediteur_id = session["resident_id"]
    
    resident_info = ResidentDB.get_by_id(expediteur_id)
    sender_name = f"{resident_info.get('prenom', '')} {resident_info.get('nom', '')}"
    
    if session["role"] == "admin":
        dest_id = int(d["destinataire_id"])
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
@admin_requis
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
    return jsonify(AlerteDB.get_active(residence_id))

@app.route("/api/alertes/historique", methods=["GET"])
@admin_requis
def get_alertes_historique():
    return jsonify(AlerteDB.get_history())

@app.route("/api/alertes/<int:alerte_id>/archiver", methods=["POST"])
@admin_requis
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
@admin_requis
def creer_alerte():
    d = request.get_json()
    if not d:
        return jsonify({"erreur": "Donnees manquantes"}), 400
    
    residence_id = d.get("residence_id")  # Can be None for all residences
    
    type_emoji = {
        "info": "ℹ️",
        "attention": "⚠️",
        "danger": "🚨",
        "succes": "✅"
    }.get(d.get("type_alerte", "info"), "ℹ️")
    
    try:
        AlerteDB.create(d["titre"], d["contenu"], d["type_alerte"], session["resident_id"], residence_id)
        
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
@admin_requis
def supprimer_alerte(alerte_id):
    AlerteDB.delete(alerte_id)
    return jsonify({"succes": True})


# -- REQUETES ------------------------------------------------------------------

@app.route("/api/requetes", methods=["GET"])
@login_requis
def get_requetes():
    if session["role"] == "admin":
        return jsonify(RequeteDB.get_all())
    return jsonify(RequeteDB.get_by_resident(session["resident_id"]))

@app.route("/api/requetes/historique", methods=["GET"])
@admin_requis
def get_requetes_historique():
    return jsonify(RequeteDB.get_history())

@app.route("/api/requetes/<int:requete_id>", methods=["DELETE"])
@admin_requis
def supprimer_requete(requete_id):
    RequeteDB.delete(requete_id)
    return jsonify({"succes": True})

@app.route("/api/requetes/non-lues-admin", methods=["GET"])
@admin_requis
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
@admin_requis
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
@admin_requis
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

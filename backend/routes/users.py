from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.models import User, db

users_bp = Blueprint('users', __name__)

@users_bp.route('/search', methods=['GET'])
@login_required
def search_users():
    query = request.args.get('q', '').strip()
    if len(query) < 3:
        return jsonify([]), 200
    
    try:
        users = User.query.filter(
            (User.phone.like(f'%{query}%') | User.name.like(f'%{query}%')) &
            (User.id != current_user.id)
        ).limit(10).all()
    except Exception as e:
        return jsonify({'error': 'Search failed'}), 500
    
    return jsonify([{
        'id': user.id,
        'name': user.name,
        'phone': user.phone,
        'avatar': user.avatar,
        'is_online': user.is_online
    } for user in users]), 200

@users_bp.route('/by-phone/<phone>', methods=['GET'])
@login_required
def get_user_by_phone(phone):
    try:
        user = User.query.filter_by(phone=phone).first()
        if not user or user.id == current_user.id:
            return jsonify({'error': 'User not found'}), 404
    except Exception as e:
        return jsonify({'error': 'Database error'}), 500
    
    return jsonify({
        'id': user.id,
        'name': user.name,
        'phone': user.phone,
        'avatar': user.avatar,
        'is_online': user.is_online
    }), 200
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from backend.models import Call, User, db
from datetime import datetime

calls_bp = Blueprint('calls', __name__)

@calls_bp.route('/initiate', methods=['POST'])
@login_required
def initiate_call():
    data = request.get_json()
    receiver_id = data.get('receiver_id')
    call_type = data.get('call_type', 'audio')  # audio or video
    
    if not receiver_id:
        return jsonify({'error': 'Receiver ID required'}), 400
    
    receiver = User.query.get(receiver_id)
    if not receiver:
        return jsonify({'error': 'User not found'}), 404
    
    try:
        call = Call(
            caller_id=current_user.id,
            receiver_id=receiver_id,
            call_type=call_type,
            status='initiated'
        )
        db.session.add(call)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to initiate call'}), 500
    
    return jsonify({
        'call_id': call.id,
        'caller': {
            'id': current_user.id,
            'name': current_user.name,
            'phone': current_user.phone
        },
        'receiver': {
            'id': receiver.id,
            'name': receiver.name,
            'phone': receiver.phone
        },
        'call_type': call_type,
        'status': 'initiated'
    }), 201

@calls_bp.route('/<int:call_id>/answer', methods=['POST'])
@login_required
def answer_call(call_id):
    call = Call.query.get_or_404(call_id)
    
    if call.receiver_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        call.status = 'answered'
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to answer call'}), 500
    
    return jsonify({
        'call_id': call.id,
        'status': 'answered',
        'caller': {
            'id': call.caller.id,
            'name': call.caller.name,
            'phone': call.caller.phone
        }
    }), 200

@calls_bp.route('/<int:call_id>/end', methods=['POST'])
@login_required
def end_call(call_id):
    call = Call.query.get_or_404(call_id)
    
    if call.caller_id != current_user.id and call.receiver_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        # If call was never answered, mark as missed
        if call.status == 'initiated':
            call.status = 'missed'
        else:
            call.status = 'ended'
            
        call.ended_at = datetime.utcnow()
        if call.status == 'ended':
            duration = (call.ended_at - call.started_at).total_seconds()
            call.duration = int(duration)
        
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to end call'}), 500
    
    return jsonify({
        'call_id': call.id,
        'status': call.status,
        'duration': call.duration
    }), 200

@calls_bp.route('/<int:call_id>/reject', methods=['POST'])
@login_required
def reject_call(call_id):
    call = Call.query.get_or_404(call_id)
    
    if call.receiver_id != current_user.id:
        return jsonify({'error': 'Unauthorized'}), 403
    
    try:
        call.status = 'missed'
        call.ended_at = datetime.utcnow()
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to reject call'}), 500
    
    return jsonify({
        'call_id': call.id,
        'status': 'missed'
    }), 200

@calls_bp.route('/history', methods=['GET'])
@login_required
def call_history():
    try:
        calls = Call.query.filter(
            (Call.caller_id == current_user.id) | (Call.receiver_id == current_user.id)
        ).order_by(Call.started_at.desc()).limit(50).all()
    except Exception as e:
        return jsonify({'error': 'Failed to load call history'}), 500
    
    return jsonify([{
        'id': call.id,
        'caller': {
            'id': call.caller.id,
            'name': call.caller.name,
            'phone': call.caller.phone
        },
        'receiver': {
            'id': call.receiver.id,
            'name': call.receiver.name,
            'phone': call.receiver.phone
        },
        'call_type': call.call_type,
        'status': call.status,
        'started_at': call.started_at.isoformat(),
        'duration': call.duration
    } for call in calls]), 200
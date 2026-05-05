from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, Task, User
from datetime import datetime
from utils.rbac import require_roles

tasks_bp = Blueprint('tasks', __name__)

@tasks_bp.route('', methods=['GET'])
@jwt_required()
def get_tasks():
    """Get all tasks (admin/planner)"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    # Filtering options
    status = request.args.get('status')
    priority = request.args.get('priority')
    category = request.args.get('category')
    event_id = request.args.get('event_id', type=int)
    assignee = request.args.get('assignee')
    
    # Single-instance mode: tasks are shared across dashboard users.
    query = Task.query
    
    if status:
        query = query.filter_by(status=status)
    if priority:
        query = query.filter_by(priority=priority)
    if category:
        query = query.filter_by(category=category)
    if event_id:
        query = query.filter_by(event_id=event_id)
    if assignee:
        query = query.filter_by(assigned_to=assignee)
    
    tasks = query.order_by(Task.due_date.asc(), Task.priority.desc()).all()
    
    return jsonify([task.to_dict(include_event=True) for task in tasks]), 200

@tasks_bp.route('', methods=['POST'])
@jwt_required()
def create_task():
    """Create a new task"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    # Handle JSON parsing with error handling
    try:
        data = request.get_json(force=True, silent=True)
    except Exception as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    if not data.get('title'):
        return jsonify({'error': 'Title is required'}), 400
    
    due_date = None
    if data.get('due_date'):
        try:
            due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    
    reminder_date = None
    if data.get('reminder_date'):
        try:
            reminder_date = datetime.fromisoformat(data['reminder_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({'error': 'Invalid reminder_date format'}), 400
    
    task = Task(
        user_id=user.id,
        title=data['title'].strip(),  # Trim whitespace
        description=data.get('description'),
        priority=data.get('priority', 'medium'),
        status=data.get('status', 'todo'),
        due_date=due_date,
        category=data.get('category'),
        assigned_to=data.get('assigned_to'),
        estimated_cost=data.get('estimated_cost'),
        actual_cost=data.get('actual_cost'),
        event_id=data.get('event_id'),
        reminder_date=reminder_date
    )
    
    db.session.add(task)
    db.session.commit()
    
    return jsonify(task.to_dict()), 201

@tasks_bp.route('/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    """Update a task"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    task = Task.query.filter_by(id=task_id).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    # Handle JSON parsing with error handling
    try:
        data = request.get_json(force=True, silent=True)
    except Exception as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 400
    
    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400
    
    if 'title' in data:
        task.title = data['title']
    if 'description' in data:
        task.description = data['description']
    if 'priority' in data:
        task.priority = data['priority']
    if 'status' in data:
        task.status = data['status']
        if data['status'] == 'completed' and not task.completed_at:
            task.completed_at = datetime.utcnow()
        elif data['status'] != 'completed':
            task.completed_at = None
    if 'due_date' in data:
        if data['due_date']:
            try:
                task.due_date = datetime.strptime(data['due_date'], '%Y-%m-%d').date()
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        else:
            task.due_date = None
    if 'category' in data:
        task.category = data['category']
    if 'assigned_to' in data:
        task.assigned_to = data['assigned_to']
    if 'estimated_cost' in data:
        task.estimated_cost = data['estimated_cost']
    if 'actual_cost' in data:
        task.actual_cost = data['actual_cost']
    if 'event_id' in data:
        task.event_id = data['event_id'] if data['event_id'] else None
    if 'reminder_date' in data:
        if data['reminder_date']:
            try:
                task.reminder_date = datetime.fromisoformat(data['reminder_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({'error': 'Invalid reminder_date format'}), 400
        else:
            task.reminder_date = None
    
    task.updated_at = datetime.utcnow()
    db.session.commit()
    
    return jsonify(task.to_dict(include_event=True)), 200

@tasks_bp.route('/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    """Delete a task"""
    user, err = require_roles(['admin', 'planner'])
    if err:
        return err
    
    task = Task.query.filter_by(id=task_id).first()
    
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    db.session.delete(task)
    db.session.commit()
    
    return jsonify({'message': 'Task deleted successfully'}), 200


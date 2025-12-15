import React, { useState, useEffect } from 'react';

const ResourceAssignmentModal = ({ isOpen, onClose, roles, employees, onAssign }) => {
    const [assignments, setAssignments] = useState({});
    const [isValid, setIsValid] = useState(false);

    useEffect(() => {
        // Initialize assignments with empty values or existing assignments if any
        const initialAssignments = {};
        roles.forEach(role => {
            initialAssignments[role] = '';
        });
        setAssignments(initialAssignments);
    }, [roles]);

    useEffect(() => {
        // Check if all roles have been assigned
        const allAssigned = roles.every(role => assignments[role] && assignments[role].trim() !== '');
        setIsValid(allAssigned);
    }, [assignments, roles]);

    const handleAssignmentChange = (role, employeeId) => {
        setAssignments(prev => ({
            ...prev,
            [role]: employeeId
        }));
    };

    const handleSubmit = () => {
        if (isValid) {
            onAssign(assignments);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4 text-gray-800">Resource Assignment</h2>
                <p className="mb-6 text-gray-600">
                    The AI has identified the following required roles for this project.
                    Please assign an employee to each role to proceed.
                </p>

                <div className="space-y-4 mb-8">
                    {roles.map((role) => (
                        <div key={role} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                            <div className="flex-1">
                                <span className="font-medium text-gray-700">{role}</span>
                            </div>
                            <div className="flex-1 ml-4">
                                <select
                                    className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    value={assignments[role] || ''}
                                    onChange={(e) => handleAssignmentChange(role, e.target.value)}
                                >
                                    <option value="">Select Employee...</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                    {/* Note: No cancel button as per requirement "prevent closing until all roles have valid assigned employees" */}
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid}
                        className={`px-6 py-2 rounded font-medium transition-colors ${isValid
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                    >
                        Confirm Assignments
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ResourceAssignmentModal;

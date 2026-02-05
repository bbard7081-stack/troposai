import React, { useState, useEffect, useMemo } from 'react';
import { ClientData, ColumnType, Column, AppUser } from '../types';
import { Icon } from './Icon';
import { Select } from 'antd';
import { IntakeWizard } from './IntakeWizard';
import { SmartSuggestions } from './SmartSuggestions';
import { UnitsPanel } from './UnitsPanel';
import { CommunicationDrawer } from './CommunicationDrawer';

interface ClientProfileProps {
    client: ClientData;
    columns: Column[];
    users: AppUser[];
    currentUser: AppUser;
    onUpdate: (updates: Partial<ClientData>) => void;
    onClose: (fromBack?: boolean) => void;
    validationErrors?: Record<string, string>;
}

// Status calculation utilities
type IntakeStatus = 'Complete' | 'In Progress' | 'Incomplete';

function calculateIntakeStatus(client: ClientData, householdMembers: string[]): IntakeStatus {
    const hasName = !!client.name?.trim();
    const hasPhone = !!client.phone?.trim();
    const hasHousehold = householdMembers.length > 0;

    const allComplete = hasName && hasPhone && hasHousehold;
    const anyComplete = hasName || hasPhone || hasHousehold;

    if (allComplete) return 'Complete';
    if (anyComplete) return 'In Progress';
    return 'Incomplete';
}

function getStatusHelperText(status: IntakeStatus): string {
    switch (status) {
        case 'Complete':
            return 'All required information provided.';
        case 'In Progress':
            return 'Some required fields are missing.';
        case 'Incomplete':
            return 'Required client and household information needed.';
    }
}

// Status badge component
const IntakeStatusBadge: React.FC<{ status: IntakeStatus }> = ({ status }) => {
    const colors = {
        'Complete': 'bg-green-100 text-green-700 border-green-200',
        'In Progress': 'bg-blue-100 text-blue-700 border-blue-200',
        'Incomplete': 'bg-amber-100 text-amber-700 border-amber-200'
    };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${colors[status]}`}>
            {status}
        </span>
    );
};

export const ClientProfile: React.FC<ClientProfileProps> = ({ client, columns, users, currentUser, onUpdate, onClose, validationErrors = {} }) => {
    const [formData, setFormData] = useState<ClientData>(client);
    const [originalData, setOriginalData] = useState<ClientData>(client);
    const [isDirty, setIsDirty] = useState(false);
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(0);
    const [showCommDrawer, setShowCommDrawer] = useState(false);
    const [members, setMembers] = useState<string[]>(client.householdMembers ? client.householdMembers.split(',').map(s => s.trim()).filter(s => s) : []);

    const openWizard = (resume: boolean = false) => {
        if (resume) {
            // Determine resume step based on missing required fields
            if (!formData.name) setWizardStep(0);
            else if (!formData.phone) setWizardStep(1);
            else if (members.length === 0) setWizardStep(2);
            else setWizardStep(0); // Default to start if all core requirements met
        } else {
            setWizardStep(0);
        }
        setShowWizard(true);
    };

    useEffect(() => {
        setFormData(client);
        setOriginalData(client);
        setMembers(client.householdMembers ? client.householdMembers.split(',').map(s => s.trim()).filter(s => s) : []);
        setIsDirty(false);
    }, [client]);

    // Handle Browser Back Button
    useEffect(() => {
        const handlePopState = (event: PopStateEvent) => {
            if (isDirty) {
                window.history.pushState(null, '', window.location.href);
                setShowUnsavedModal(true);
            } else {
                onClose(true);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isDirty, onClose]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + S to save
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (isDirty) handleSave();
            }
            // Cmd/Ctrl + K to open communications
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommDrawer(prev => !prev);
            }
            // Escape to close
            if (e.key === 'Escape') {
                if (showCommDrawer) setShowCommDrawer(false);
                else if (showWizard) setShowWizard(false);
                else handleCloseAttempt();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDirty, showCommDrawer, showWizard]);

    // Compute intake status
    const intakeStatus = useMemo(() => {
        return calculateIntakeStatus(formData, members);
    }, [formData.name, formData.phone, members]);

    {/* Right Column: Household Management */ }



    const handleFieldChange = (field: string, value: any) => {
        const updated = { ...formData, [field]: value };
        setFormData(updated);
        setIsDirty(true);
        // onUpdate({[field]: value }); // Removed auto-save
    };

    const handleSave = () => {
        // Calculate diff or send full object. Sending updates.
        // For ClientProfile, we can send all changes
        const updates: Partial<ClientData> = {};
        Object.keys(formData).forEach(key => {
            if (formData[key] !== originalData[key]) {
                updates[key] = formData[key];
            }
        });

        // Also handle householdMembers string
        const membersStr = members.join(', ');
        if (membersStr !== (originalData.householdMembers || '')) {
            updates.householdMembers = membersStr;
        }

        onUpdate(updates);
        setOriginalData({ ...formData, householdMembers: membersStr });
        setIsDirty(false);
    };

    const handleCloseAttempt = () => {
        if (isDirty) {
            setShowUnsavedModal(true);
        } else {
            onClose();
        }
    };

    const addMember = () => {
        const newMembers = [...members, ""];
        // const membersStr = newMembers.join(', ');
        setMembers(newMembers);
        setIsDirty(true);
        // onUpdate({householdMembers: membersStr });
    };

    const removeMember = (idx: number) => {
        const newMembers = members.filter((_, i) => i !== idx);
        // const membersStr = newMembers.join(', ');
        setMembers(newMembers);
        setIsDirty(true);
        // onUpdate({householdMembers: membersStr });
    };

    const updateMember = (idx: number, name: string) => {
        const newMembers = [...members];
        newMembers[idx] = name;
        // const membersStr = newMembers.join(', ');
        setMembers(newMembers);
        setIsDirty(true);
        // onUpdate({householdMembers: membersStr });
    };

    const renderField = (col: Column) => {
        // householdMembers is handled in its own section
        if (col.id === 'householdMembers') return null;

        const val = formData[col.id];
        const error = validationErrors[`${client.id}-${col.id}`];

        // householdSize is derived, id/timestamps are immutable
        const isReadOnly = col.id === 'id' || col.id === 'created_at' || col.id === 'updated_at';

        const baseInputClass = `w-full px-5 py-3.5 bg-white border ${error ? 'border-red-500 ring-4 ring-red-500/10' : 'border-slate-200'} rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none transition-all font-bold text-slate-700 ${isReadOnly ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : ''}`;

        return (
            <div key={col.id} className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{col.title}</label>

                {col.type === ColumnType.DROPDOWN ? (
                    <div className="relative group/dd">
                        <select
                            value={val || ''}
                            onChange={(e) => handleFieldChange(col.id, e.target.value)}
                            disabled={isReadOnly}
                            className={`${baseInputClass} appearance-none pr-10 cursor-pointer`}
                        >
                            <option value="">Select...</option>
                            {(col.id === 'assignedTo' ? users.map(u => u.email) : col.options || []).map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover/dd:text-blue-500 transition-colors">
                            <Icon name="chevron-down" size={14} />
                        </div>
                    </div>
                ) : col.type === ColumnType.MULTI_SELECT ? (
                    <div className="ant-select-profile">
                        <Select
                            mode="tags"
                            allowClear
                            disabled={isReadOnly}
                            style={{ width: '100%' }}
                            placeholder="SELECT..."
                            value={Array.isArray(val) ? val : (typeof val === 'string' && val ? val.split(',') : [])}
                            onChange={(newVal) => handleFieldChange(col.id, newVal)}
                            options={(col.options || []).map(opt => ({ label: opt, value: opt }))}
                            className="ant-select-custom-profile"
                            popupClassName="ant-select-dropdown-custom"
                        />
                    </div>
                ) : (
                    <input
                        type={col.type === ColumnType.DATE ? 'date' : col.type === ColumnType.NUMBER ? 'number' : 'text'}
                        value={val || ''}
                        readOnly={isReadOnly}
                        onChange={(e) => handleFieldChange(col.id, col.type === ColumnType.NUMBER ? Number(e.target.value) : e.target.value)}
                        className={baseInputClass}
                    />
                )}
                {error && <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">{error}</p>}
            </div>
        );
    };

    // Determine status for the header toggle
    // Using 'level' as it maps to the Grid's primary status dropdown
    const currentStatus = client.level || 'No Contact';
    const isApproved = client.approved === 'Yes';

    return (
        <div className="fixed inset-0 z-[150] bg-slate-100 flex flex-col animate-in slide-in-from-right duration-300">
            {showUnsavedModal && (
                <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h3 className="text-xl font-black text-slate-800 mb-2">Unsaved Changes</h3>
                        <p className="text-slate-500 mb-8">You have unsaved changes. Do you want to save them before leaving?</p>
                        <div className="flex flex-col space-y-3">
                            <button
                                onClick={() => {
                                    handleSave();
                                    setShowUnsavedModal(false);
                                    onClose();
                                }}
                                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                            >
                                Save & Close
                            </button>
                            <button
                                onClick={() => {
                                    setShowUnsavedModal(false);
                                    onClose();
                                }}
                                className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                            >
                                Discard Changes
                            </button>
                            <button
                                onClick={() => setShowUnsavedModal(false)}
                                className="w-full py-3 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                            >
                                Keep Editing
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="h-auto bg-white border-b border-slate-200 px-10 py-6 shrink-0">
                <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                        <button onClick={handleCloseAttempt} className="p-3 hover:bg-slate-100 rounded-2xl transition-all text-slate-500 mt-1"><Icon name="logout" size={20} className="rotate-180" /></button>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Client Profile</h2>
                            <div className="flex items-center space-x-2 mt-2">
                                <span className="text-xs font-bold text-slate-500">Intake Status:</span>
                                <IntakeStatusBadge status={intakeStatus} />
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                {getStatusHelperText(intakeStatus)}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-3">
                        {(intakeStatus === 'In Progress' || intakeStatus === 'Incomplete') && (
                            <button
                                onClick={() => openWizard(true)}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
                            >
                                Continue Intake
                            </button>
                        )}
                        {isDirty && (
                            <button
                                onClick={handleSave}
                                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-xl shadow-blue-500/20 active:scale-95 transition-all animate-in fade-in"
                            >
                                Save Changes
                            </button>
                        )}
                        <button onClick={handleCloseAttempt} className="px-6 py-2.5 bg-slate-950 text-white rounded-xl font-bold text-sm shadow-xl shadow-slate-900/20 active:scale-95 transition-all">Close</button>
                    </div>
                </div>
            </header>

            {showWizard && (
                <IntakeWizard
                    client={formData}
                    initialStep={wizardStep}
                    onUpdate={(updates) => {
                        const newData = { ...formData, ...updates };
                        setFormData(newData);
                        setIsDirty(true);
                        // Optional: Auto-save after wizard
                    }}
                    onClose={() => setShowWizard(false)}
                />
            )}

            <div className="flex-1 overflow-auto p-12">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Left & Middle Column: Main Profile Data */}
                    <section className="lg:col-span-2 space-y-10">
                        <SmartSuggestions
                            client={formData}
                            onApply={(updates) => {
                                const newData = { ...formData, ...updates };
                                setFormData(newData);
                                setIsDirty(true);
                            }}
                        />

                        <div className="bg-white border border-slate-200 rounded-[32px] p-10 shadow-sm">
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em] flex items-center space-x-3">
                                    <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
                                    <span>Authoritative Client Data</span>
                                </h3>
                                <button
                                    onClick={() => openWizard(false)}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-bold hover:underline transition-all flex items-center space-x-1"
                                >
                                    <span>Start Guided Intake</span>
                                    <Icon name="arrow-right" size={12} />
                                </button>
                            </div>

                            {/* Client Basics Group */}
                            <div className="mb-10">
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Client Basics
                                </h4>
                                <p className="text-xs text-slate-400 mb-6">
                                    Core client information used across the system.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {columns.filter(c => ['name', 'dob', 'phone', 'email', 'crmStatus'].includes(c.id)).map(renderField)}
                                </div>
                            </div>

                            <hr className="my-8 border-slate-100" />

                            {/* Household Members (Unified) */}
                            <div className="mb-10">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1 flex items-center">
                                            Household Members <span className="text-red-500 ml-1">*</span>
                                        </h4>
                                        <p className="text-xs text-slate-400">
                                            At least one household member is required.
                                        </p>
                                    </div>
                                    <button onClick={addMember} className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-[10px] font-black uppercase">
                                        <Icon name="plus" size={12} />
                                        <span>Add</span>
                                    </button>
                                </div>

                                {members.length > 0 ? (
                                    <div className="space-y-4">
                                        <div className="p-3 bg-slate-50 rounded-xl inline-block">
                                            <span className="text-xs font-bold text-slate-600">
                                                Household Size: {members.length} (calculated automatically)
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {members.map((m, i) => (
                                                <div key={i} className="flex items-center space-x-3 animate-in slide-in-from-right-4 duration-200">
                                                    <span className="text-slate-400 font-bold">•</span>
                                                    <div className="flex-1 flex items-center space-x-2">
                                                        <input
                                                            className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none"
                                                            value={m}
                                                            onChange={(e) => updateMember(i, e.target.value)}
                                                            placeholder="Member Name & Relation"
                                                        />
                                                        <button onClick={() => removeMember(i)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                                                            <Icon name="trash" size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl text-center space-y-2">
                                        <p className="text-sm font-black text-amber-800 uppercase tracking-wide">
                                            No household members added yet
                                        </p>
                                        <p className="text-xs font-medium text-amber-700">
                                            You must add at least one household member to complete intake.
                                        </p>
                                        <button onClick={addMember} className="mt-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors">
                                            + Add First Member
                                        </button>
                                    </div>
                                )}
                            </div>

                            <hr className="my-8 border-slate-100" />

                            {/* Address & Location Group */}
                            <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Address & Location
                                </h4>
                                <p className="text-xs text-slate-400 mb-6">
                                    Used for eligibility and reporting.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {columns.filter(c => ['address', 'city', 'zip', 'state', 'county'].includes(c.id)).map(renderField)}
                                </div>
                            </div>

                            <hr className="my-8 border-slate-100" />

                            {/* Other Fields Group */}
                            <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Additional Info
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 mt-6">
                                    {columns.filter(c => !['name', 'dob', 'phone', 'email', 'crmStatus', 'address', 'city', 'zip', 'state', 'county', 'householdMembers', 'level', 'id', 'created_at', 'updated_at'].includes(c.id)).map(renderField)}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Right Column: Actions & Traceability */}
                    <section className="space-y-10">
                        {/* Units Panel - moved here from bottom of prev layout */}
                        <div className="h-[600px]">
                            <UnitsPanel
                                contactId={client.id}
                                currentUser={currentUser.email}
                            />
                        </div>
                    </section>
                </div>


            </div>


            {/* Communication Drawer */}
            {
                showCommDrawer && (
                    <CommunicationDrawer
                        contactId={client.id}
                        contactName={formData.name || 'Unknown'}
                        onClose={() => setShowCommDrawer(false)}
                    />
                )
            }
        </div >
    );
};

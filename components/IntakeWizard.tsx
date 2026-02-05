import React, { useState } from 'react';
import { ClientData } from '../types';
import { Icon } from './Icon';

interface IntakeWizardProps {
    client: ClientData;
    onUpdate: (updates: Partial<ClientData>) => void;
    onClose: () => void;
    initialStep?: number;
}

const STEPS = [
    { title: 'Basic Info', description: 'Name & Demographics' },
    { title: 'Contact Details', description: 'Phone & Address' },
    { title: 'Household', description: 'Size & Members' },
    { title: 'Qualifications', description: 'Programs & Services' },
    { title: 'Timeline', description: 'Important Dates' },
    { title: 'Assignment', description: 'Status & Owner' }
];

export const IntakeWizard: React.FC<IntakeWizardProps> = ({ client, onUpdate, onClose, initialStep = 0 }) => {
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [formData, setFormData] = useState<Partial<ClientData>>({});
    const [householdMembers, setHouseholdMembers] = useState<string[]>(
        client.householdMembers ? client.householdMembers.split(',').map(s => s.trim()).filter(s => s) : []
    );

    const handleNext = () => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            // Finish - include household members
            const updates = {
                ...formData,
                householdMembers: householdMembers.join(', '),
                householdSize: householdMembers.length
            };
            onUpdate(updates);
            onClose();
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const addHouseholdMember = () => {
        setHouseholdMembers([...householdMembers, '']);
    };

    const updateHouseholdMember = (index: number, value: string) => {
        const updated = [...householdMembers];
        updated[index] = value;
        setHouseholdMembers(updated);
    };

    const removeHouseholdMember = (index: number) => {
        setHouseholdMembers(householdMembers.filter((_, i) => i !== index));
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 0: // Basic Info
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Full Name *</label>
                            <input
                                autoFocus
                                className="w-full text-lg font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                                defaultValue={client.name}
                                onChange={(e) => handleChange('name', e.target.value)}
                                placeholder="e.g. Jane Doe"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Date of Birth</label>
                            <input
                                type="date"
                                className="w-full text-lg font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                                defaultValue={client.dob}
                                onChange={(e) => handleChange('dob', e.target.value)}
                            />
                        </div>
                    </div>
                );

            case 1: // Contact Details
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Phone Number *</label>
                            <input
                                autoFocus
                                type="tel"
                                className="w-full text-lg font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                                defaultValue={client.phone}
                                onChange={(e) => handleChange('phone', e.target.value)}
                                placeholder="(555) 555-5555"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Street Address</label>
                            <input
                                className="w-full text-lg font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                                defaultValue={client.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                                placeholder="123 Main Street"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">City</label>
                            <input
                                className="w-full text-lg font-bold border-b-2 border-slate-200 focus:border-blue-500 outline-none py-2 bg-transparent transition-colors"
                                defaultValue={client.city}
                                onChange={(e) => handleChange('city', e.target.value)}
                                placeholder="City Name"
                            />
                        </div>
                    </div>
                );

            case 2: // Household
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Household Members</label>
                                <button
                                    type="button"
                                    onClick={addHouseholdMember}
                                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-xs font-bold uppercase"
                                >
                                    <Icon name="plus" size={12} />
                                    <span>Add Member</span>
                                </button>
                            </div>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto">
                                {householdMembers.map((member, index) => (
                                    <div key={index} className="flex items-center space-x-2">
                                        <div className="flex-1 flex items-center space-x-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                            <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">{index + 1}</span>
                                            <input
                                                className="flex-1 bg-transparent font-bold text-slate-700 outline-none"
                                                value={member}
                                                onChange={(e) => updateHouseholdMember(index, e.target.value)}
                                                placeholder="Member name"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeHouseholdMember(index)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            <Icon name="trash" size={16} />
                                        </button>
                                    </div>
                                ))}
                                {householdMembers.length === 0 && (
                                    <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                                        No household members added yet
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="text-sm text-slate-600"><span className="font-bold">Household Size:</span> {householdMembers.length} {householdMembers.length === 1 ? 'person' : 'people'}</p>
                        </div>
                    </div>
                );

            case 3: // Qualifications
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Qualified For (Programs/Services)</label>
                            <textarea
                                autoFocus
                                className="w-full text-base font-medium border-2 border-slate-200 focus:border-blue-500 outline-none p-3 bg-white rounded-xl transition-colors resize-none"
                                rows={4}
                                defaultValue={Array.isArray(client.qualifiedFor) ? client.qualifiedFor.join(', ') : client.qualifiedFor}
                                onChange={(e) => handleChange('qualifiedFor', e.target.value.split(',').map(s => s.trim()).filter(s => s))}
                                placeholder="e.g. SNAP, Medicaid, Housing Assistance (comma-separated)"
                            />
                            <p className="text-xs text-slate-400 mt-2">Separate multiple programs with commas</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Approval Status</label>
                            <select
                                className="w-full text-base font-bold border-2 border-slate-200 focus:border-blue-500 outline-none p-3 bg-white rounded-xl transition-colors cursor-pointer"
                                defaultValue={client.approved || 'Pending'}
                                onChange={(e) => handleChange('approved', e.target.value)}
                            >
                                <option value="Pending">Pending Review</option>
                                <option value="Yes">Approved</option>
                                <option value="No">Not Approved</option>
                            </select>
                        </div>
                    </div>
                );

            case 4: // Timeline
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Date Outreached</label>
                            <input
                                autoFocus
                                type="date"
                                className="w-full text-base font-bold border-2 border-slate-200 focus:border-blue-500 outline-none p-3 bg-white rounded-xl transition-colors"
                                defaultValue={client.dateOutreached}
                                onChange={(e) => handleChange('dateOutreached', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Date Screened</label>
                            <input
                                type="date"
                                className="w-full text-base font-bold border-2 border-slate-200 focus:border-blue-500 outline-none p-3 bg-white rounded-xl transition-colors"
                                defaultValue={client.dateScreened}
                                onChange={(e) => handleChange('dateScreened', e.target.value)}
                            />
                        </div>
                    </div>
                );

            case 5: // Assignment
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">CRM Status</label>
                            <select
                                autoFocus
                                className="w-full text-base font-bold border-2 border-slate-200 focus:border-blue-500 outline-none p-3 bg-white rounded-xl transition-colors cursor-pointer"
                                defaultValue={client.crmStatus || 'No Contact'}
                                onChange={(e) => handleChange('crmStatus', e.target.value)}
                            >
                                <option value="No Contact">No Contact</option>
                                <option value="Screening Completed">Screening Completed</option>
                                <option value="EA Completed">EA Completed</option>
                                <option value="Approval Pending">Approval Pending</option>
                                <option value="Approved">Approved</option>
                                <option value="Services Rendered">Services Rendered</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Service Level</label>
                            <select
                                className="w-full text-base font-bold border-2 border-slate-200 focus:border-blue-500 outline-none p-3 bg-white rounded-xl transition-colors cursor-pointer"
                                defaultValue={client.level || 'Approved'}
                                onChange={(e) => handleChange('level', e.target.value)}
                            >
                                <option value="Approved">Active / Approved</option>
                                <option value="Services Rendered">Done / Rendered</option>
                            </select>
                        </div>
                        <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-green-800 text-sm">
                            <p className="font-bold mb-1">✓ Ready to Complete</p>
                            <p>Click "Complete Intake" to save all information to the client profile.</p>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">Comprehensive Intake</h2>
                            <p className="text-blue-100 font-medium mt-1">Complete client assessment</p>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <Icon name="x" size={20} />
                        </button>
                    </div>

                    {/* Step Indicators */}
                    <div className="flex items-center space-x-2">
                        {STEPS.map((step, index) => (
                            <div key={index} className="flex items-center flex-1">
                                <div className={`flex-1 h-1.5 rounded-full transition-all ${index <= currentStep ? 'bg-white' : 'bg-white/30'}`} />
                            </div>
                        ))}
                    </div>
                    <p className="text-sm text-blue-100 mt-3 font-medium">
                        Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
                    </p>
                </div>

                {/* Content */}
                <div className="p-8 flex-1 overflow-y-auto">
                    <h3 className="text-lg font-black text-slate-800 mb-2">{STEPS[currentStep].title}</h3>
                    <p className="text-sm text-slate-500 mb-6">{STEPS[currentStep].description}</p>
                    {renderStepContent()}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                    <button
                        onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                        disabled={currentStep === 0}
                        className={`px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center space-x-2 ${currentStep === 0
                            ? 'text-slate-300 cursor-not-allowed'
                            : 'text-slate-600 hover:bg-slate-200'
                            }`}
                    >
                        <Icon name="arrow-left" size={16} />
                        <span>Back</span>
                    </button>
                    <button
                        onClick={handleNext}
                        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all flex items-center space-x-2"
                    >
                        <span>{currentStep === STEPS.length - 1 ? 'Complete Intake' : 'Next Step'}</span>
                        {currentStep < STEPS.length - 1 && <Icon name="arrow-right" size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

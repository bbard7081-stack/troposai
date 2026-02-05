import React, { useState, useEffect } from 'react';
import { Icon } from './Icon';
import * as api from '../services/api';

const PasswordSetup: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Get email from URL parameter
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email');
        if (emailParam) {
            setEmail(emailParam);
        } else {
            setError('Invalid invitation link. Email parameter is missing.');
        }
    }, []);

    const validatePassword = (pwd: string): string | null => {
        if (pwd.length < 8) {
            return 'Password must be at least 8 characters long';
        }
        if (!/[A-Z]/.test(pwd)) {
            return 'Password must contain at least one uppercase letter';
        }
        if (!/[a-z]/.test(pwd)) {
            return 'Password must contain at least one lowercase letter';
        }
        if (!/[0-9]/.test(pwd)) {
            return 'Password must contain at least one number';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!email) {
            setError('Email is required');
            return;
        }

        const passwordError = validatePassword(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            await api.setPassword(email, password);
            setSuccess(true);

            // Redirect to login after 2 seconds
            setTimeout(() => {
                window.location.href = '/simchatalent/';
            }, 2000);
        } catch (err: any) {
            setError(err.message || 'Failed to set password. Please try again.');
            setLoading(false);
        }
    };

    const getPasswordStrength = (): { strength: string; color: string; width: string } => {
        if (!password) return { strength: '', color: '', width: '0%' };

        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score <= 2) return { strength: 'Weak', color: 'bg-red-500', width: '33%' };
        if (score <= 4) return { strength: 'Medium', color: 'bg-yellow-500', width: '66%' };
        return { strength: 'Strong', color: 'bg-green-500', width: '100%' };
    };

    const passwordStrength = getPasswordStrength();

    if (success) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full text-center border border-slate-200">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Icon name="check" size={40} className="text-green-600" />
                    </div>
                    <h1 className="text-3xl font-black text-slate-800 mb-4">Password Set Successfully!</h1>
                    <p className="text-slate-600 mb-6">Redirecting you to the login page...</p>
                    <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-md w-full border border-slate-200">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black text-slate-800 mb-2">Set Your Password</h1>
                    <p className="text-slate-600">Welcome to Tropos CRM</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Email Display */}
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            Email Address
                        </label>
                        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-600">
                            {email || 'Loading...'}
                        </div>
                    </div>

                    {/* Password Input */}
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            New Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            placeholder="Enter your password"
                            required
                            disabled={loading}
                        />
                        {password && (
                            <div className="mt-2">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-slate-400">Password Strength</span>
                                    <span className={`text-xs font-bold ${passwordStrength.strength === 'Strong' ? 'text-green-600' : passwordStrength.strength === 'Medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                                        {passwordStrength.strength}
                                    </span>
                                </div>
                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                                        style={{ width: passwordStrength.width }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password Input */}
                    <div>
                        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all"
                            placeholder="Confirm your password"
                            required
                            disabled={loading}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
                            <Icon name="alert" size={20} className="text-red-600 mt-0.5" />
                            <p className="text-sm font-bold text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Password Requirements */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <p className="text-xs font-black text-blue-800 uppercase tracking-widest mb-2">Password Requirements:</p>
                        <ul className="space-y-1 text-xs text-blue-600">
                            <li className="flex items-center space-x-2">
                                <Icon name={password.length >= 8 ? 'check' : 'circle'} size={12} className={password.length >= 8 ? 'text-green-600' : 'text-slate-300'} />
                                <span>At least 8 characters</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <Icon name={/[A-Z]/.test(password) ? 'check' : 'circle'} size={12} className={/[A-Z]/.test(password) ? 'text-green-600' : 'text-slate-300'} />
                                <span>One uppercase letter</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <Icon name={/[a-z]/.test(password) ? 'check' : 'circle'} size={12} className={/[a-z]/.test(password) ? 'text-green-600' : 'text-slate-300'} />
                                <span>One lowercase letter</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <Icon name={/[0-9]/.test(password) ? 'check' : 'circle'} size={12} className={/[0-9]/.test(password) ? 'text-green-600' : 'text-slate-300'} />
                                <span>One number</span>
                            </li>
                        </ul>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-black text-sm shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Setting Password...' : 'Set Password & Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PasswordSetup;

import React, { useState, useEffect, useRef } from 'react';
import { Medication, View, FrequencyType, HistoryLog } from './types';
import { Navigation } from './components/Navigation';
import { MedicationCard } from './components/MedicationCard';
import { Button } from './components/Button';
import { parseMedicationInstruction, analyzeHistory, getMedicationRisks } from './services/geminiService';
import { Sparkles, X, Search, Bell, History, CheckCircle2, Share2 } from 'lucide-react';

// Default data for demo purposes
const DEFAULT_MEDS: Medication[] = [];

const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-violet-500'];

const App: React.FC = () => {
    const [view, setView] = useState<View>('dashboard');

    // Data State
    const [medications, setMedications] = useState<Medication[]>(() => {
        const saved = localStorage.getItem('medications');
        return saved ? JSON.parse(saved) : DEFAULT_MEDS;
    });

    const [history, setHistory] = useState<HistoryLog[]>(() => {
        const saved = localStorage.getItem('history');
        return saved ? JSON.parse(saved) : [];
    });

    // Form State
    const [aiInput, setAiInput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [showAiModal, setShowAiModal] = useState(false);

    // Manual Form State - Strings to avoid "0" input issues
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [newDosage, setNewDosage] = useState('');
    const [newFreqType, setNewFreqType] = useState<FrequencyType>(FrequencyType.DAILY);
    const [newFreqVal, setNewFreqVal] = useState('1');
    const [newInventory, setNewInventory] = useState('30');
    const [isManualLoading, setIsManualLoading] = useState(false);

    // Analysis State
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Notification State
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const lastCheckRef = useRef<number>(Date.now());

    // Persistence
    useEffect(() => {
        localStorage.setItem('medications', JSON.stringify(medications));
    }, [medications]);

    useEffect(() => {
        localStorage.setItem('history', JSON.stringify(history));
    }, [history]);

    // Notifications Logic
    useEffect(() => {
        if ('Notification' in window) {
            if (Notification.permission === 'granted') {
                setNotificationsEnabled(true);
            }
        }

        const checkInterval = setInterval(() => {
            if (Notification.permission === 'granted') {
                checkDueMedications();
            }
        }, 60000); // Check every minute

        return () => clearInterval(checkInterval);
    }, [medications]);

    const requestNotificationPermission = async () => {
        if (!('Notification' in window)) {
            alert("Tu navegador no soporta notificaciones.");
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            setNotificationsEnabled(true);
            new Notification("MediRecordatorio", {
                body: "¡Alertas activadas! Te avisaremos cuando sea hora de tu medicina.",
                icon: "/pwa-192x192.png"
            });
        }
    };

    const checkDueMedications = () => {
        const now = new Date();
        // Only notify if we haven't checked in the last 50 seconds
        if (Date.now() - lastCheckRef.current < 50000) return;
        lastCheckRef.current = Date.now();

        medications.forEach(med => {
            if (med.nextDose) {
                const doseTime = new Date(med.nextDose);
                // If dose time is within the last minute or past due, and not taken
                if (doseTime <= now) {
                    new Notification(`Hora de tu medicamento`, {
                        body: `Es hora de tomar: ${med.name} (${med.dosage})`,
                        tag: med.id
                    });
                }
            }
        });
    };

    const handleTakeMedication = (id: string) => {
        const medToTake = medications.find(m => m.id === id);
        if (medToTake) {
            // 1. Log History
            const newLog: HistoryLog = {
                id: crypto.randomUUID(),
                medicationName: medToTake.name,
                takenAt: new Date().toISOString(),
                status: 'taken'
            };
            setHistory(prev => [newLog, ...prev]);

            // 2. Decrement Inventory & Check Stock
            const currentStock = medToTake.inventory ?? 0;
            const newStock = Math.max(0, currentStock - 1);

            if (newStock <= 5 && newStock > 0) {
                // Simple alert for now, could be a notification
                setTimeout(() => alert(`⚠️ Atención: Te quedan pocas pastillas de ${medToTake.name} (${newStock})`), 500);
            }

            // 3. Update Medication State
            setMedications(prev => prev.map(med => {
                if (med.id !== id) return med;

                let nextDate = new Date();

                // Calculate next dose based on schedule logic
                if (med.frequencyType === FrequencyType.HOURLY) {
                    nextDate.setHours(nextDate.getHours() + med.frequencyValue);
                } else if (med.frequencyType === FrequencyType.DAILY) {
                    nextDate.setDate(nextDate.getDate() + 1);
                } else if (med.frequencyType === FrequencyType.WEEKLY) {
                    nextDate.setDate(nextDate.getDate() + (med.frequencyValue * 7));
                }

                return {
                    ...med,
                    nextDose: nextDate.toISOString(),
                    inventory: newStock
                };
            }));
        }
    };

    const handleSnooze = (id: string, minutes: number) => {
        setMedications(prev => prev.map(med => {
            if (med.id !== id) return med;

            const now = new Date();
            now.setMinutes(now.getMinutes() + minutes);

            return {
                ...med,
                nextDose: now.toISOString()
            };
        }));
    };

    const handleDelete = (id: string) => {
        setMedications(prev => prev.filter(m => m.id !== id));
    };

    const handleEdit = (med: Medication) => {
        setEditingId(med.id);
        setNewName(med.name);
        setNewDosage(med.dosage);
        setNewFreqType(med.frequencyType);
        setNewFreqVal(med.frequencyValue.toString());
        setNewInventory((med.inventory ?? 30).toString());
        setView('add');
    };

    const resetForm = () => {
        setNewName('');
        setNewDosage('');
        setNewFreqType(FrequencyType.DAILY);
        setNewFreqVal('1');
        setNewInventory('30');
        setEditingId(null);
    };

    const handleAiAdd = async () => {
        if (!aiInput.trim()) return;
        setIsAiLoading(true);

        // Pass existing meds to AI for interaction checking
        const existingMedsList = medications.map(m => m.name);
        const result = await parseMedicationInstruction(aiInput, existingMedsList);

        if (result) {
            const newMed: Medication = {
                id: crypto.randomUUID(),
                name: result.name,
                dosage: result.dosage || 'Estándar',
                frequencyType: (result.frequencyType as FrequencyType) || FrequencyType.DAILY,
                frequencyValue: result.frequencyValue || 1,
                notes: result.info,
                startDate: new Date().toISOString(),
                nextDose: new Date().toISOString(),
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                icon: 'pill',
                advice: result.advice,
                inventory: result.inventory || 20 // Default from AI if not found
            };
            setMedications([...medications, newMed]);
            setAiInput('');
            setShowAiModal(false);
            setView('dashboard');

            if (Notification.permission === 'default') {
                requestNotificationPermission();
            }

        } else {
            alert("No pude entender la instrucción. Intenta formato: 'Tomar X cada Y horas'");
        }

        setIsAiLoading(false);
    };

    const handleManualAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsManualLoading(true);

        const freqVal = parseInt(newFreqVal) || 1;
        const invVal = parseInt(newInventory) || 0;

        if (editingId) {
            // Edit Mode
            setMedications(prev => prev.map(m => {
                if (m.id === editingId) {
                    return {
                        ...m,
                        name: newName,
                        dosage: newDosage,
                        frequencyType: newFreqType,
                        frequencyValue: freqVal,
                        inventory: invVal
                        // We keep existing advice and nextDose/icon/color
                    };
                }
                return m;
            }));
        } else {
            // Create Mode
            // Fetch advice separately for manual add
            const existingMedsList = medications.map(m => m.name);
            const advice = await getMedicationRisks(newName, existingMedsList);

            const newMed: Medication = {
                id: crypto.randomUUID(),
                name: newName,
                dosage: newDosage,
                frequencyType: newFreqType,
                frequencyValue: freqVal,
                startDate: new Date().toISOString(),
                nextDose: new Date().toISOString(),
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                icon: 'pill',
                advice: advice,
                inventory: invVal
            };
            setMedications([...medications, newMed]);
        }

        resetForm();
        setIsManualLoading(false);
        setView('dashboard');

        if (Notification.permission === 'default') {
            requestNotificationPermission();
        }
    };

    const handleAnalyzeHistory = async () => {
        if (history.length === 0) return;
        setIsAnalyzing(true);
        const result = await analyzeHistory(history);
        setAnalysisResult(result);
        setIsAnalyzing(false);
    };

    const generateReport = () => {
        const report = `📋 REPORTE DE MEDICAMENTOS - MediRecordatorio

📅 Fecha: ${new Date().toLocaleDateString()}
💊 Medicamentos Activos:
${medications.map(m => `- ${m.name} (${m.dosage}): ${m.frequencyValue} ${m.frequencyType} (Stock: ${m.inventory})`).join('\n')}

📈 Historial Reciente (Últimos 10 registros):
${history.slice(0, 10).map(h => `- ${h.medicationName}: ${new Date(h.takenAt).toLocaleString()}`).join('\n')}

Este reporte fue generado automáticamente.`;

        // Copy to clipboard logic
        navigator.clipboard.writeText(report).then(() => {
            alert("¡Reporte copiado al portapapeles! Puedes pegarlo en WhatsApp o un email.");
        });

        // Try native share if available (mobile)
        if (navigator.share) {
            navigator.share({
                title: 'Mi Reporte de Medicamentos',
                text: report
            }).catch(console.error);
        }
    };

    // Views
    const renderDashboard = () => (
        <div className="pb-32 pt-6 px-4 space-y-6">
            <header className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Hola! 👋</h1>
                    <p className="text-slate-500 text-sm">Tus medicamentos para hoy</p>
                </div>
                <button
                    onClick={requestNotificationPermission}
                    className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${notificationsEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}
                >
                    <Bell size={20} />
                </button>
            </header>

            {/* Stats/Highlight */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-200 relative overflow-hidden">
                <div className="relative z-10">
                    <p className="text-blue-100 text-sm font-medium mb-1">Próxima Dosis</p>
                    <h2 className="text-3xl font-bold">
                        {medications.length > 0
                            ? medications.sort((a, b) => new Date(a.nextDose!).getTime() - new Date(b.nextDose!).getTime())[0].name
                            : "Sin medicinas"}
                    </h2>
                    <p className="mt-2 text-sm opacity-80">
                        {medications.length > 0
                            ? "Mantén tu racha saludable."
                            : "Añade un medicamento para empezar."}
                    </p>
                </div>
                <Sparkles className="absolute top-4 right-4 text-white opacity-20" size={80} />
            </div>

            <div className="space-y-4">
                <h3 className="font-bold text-slate-700 text-lg">Tu Lista</h3>
                {medications.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400">No hay medicamentos.</p>
                        <button onClick={() => setView('add')} className="text-blue-600 font-medium text-sm mt-2">Añadir uno ahora</button>
                    </div>
                ) : (
                    medications.map(med => (
                        <MedicationCard
                            key={med.id}
                            medication={med}
                            onTake={handleTakeMedication}
                            onDelete={handleDelete}
                            onEdit={handleEdit}
                            onSnooze={handleSnooze}
                        />
                    ))
                )}
            </div>
        </div>
    );

    const renderAdd = () => (
        <div className="pb-8 pt-6 px-4 h-full flex flex-col">
            <header className="flex justify-between items-center mb-6 shrink-0">
                <h1 className="text-2xl font-bold text-slate-800">{editingId ? 'Editar Medicamento' : 'Nuevo Medicamento'}</h1>
                <button onClick={() => { resetForm(); setView('dashboard'); }} className="p-2 bg-slate-100 rounded-full">
                    <X size={20} />
                </button>
            </header>

            {/* AI Button - Only show on Add mode for simplicity */}
            {!editingId && (
                <button
                    onClick={() => setShowAiModal(true)}
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-4 rounded-2xl flex items-center justify-between mb-8 shadow-lg shadow-violet-200 group transition-all active:scale-[0.98] shrink-0"
                >
                    <div className="text-left">
                        <span className="flex items-center gap-2 font-bold text-lg"><Sparkles size={18} /> Añadir con IA</span>
                        <p className="text-violet-100 text-sm mt-1">"Tomar aspirina cada 8 horas"</p>
                    </div>
                    <div className="bg-white/20 p-2 rounded-full">
                        <Search size={20} />
                    </div>
                </button>
            )}

            <div className="flex items-center gap-4 mb-6 shrink-0">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-slate-400 text-sm font-medium">{editingId ? 'Datos del medicamento' : 'O manual'}</span>
                <div className="h-px bg-slate-200 flex-1"></div>
            </div>

            <form onSubmit={handleManualAdd} className="flex flex-col flex-1 overflow-hidden">
                <div className="space-y-5 flex-1 overflow-y-auto pr-1 pb-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del medicamento</label>
                        <input
                            required
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej. Ibuprofeno"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dosis (Opcional)</label>
                        <input
                            value={newDosage}
                            onChange={e => setNewDosage(e.target.value)}
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Ej. 500mg"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Frecuencia</label>
                            <select
                                value={newFreqType}
                                onChange={e => setNewFreqType(e.target.value as FrequencyType)}
                                className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none"
                            >
                                <option value={FrequencyType.HOURLY}>Horas</option>
                                <option value={FrequencyType.DAILY}>Días</option>
                                <option value={FrequencyType.WEEKLY}>Semanas</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Cada cuanto</label>
                            <input
                                type="number"
                                min="1"
                                inputMode="numeric"
                                value={newFreqVal}
                                onChange={e => setNewFreqVal(e.target.value)}
                                className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none"
                            />
                        </div>
                    </div>

                    {/* Inventory Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Stock Actual (Pastillas)</label>
                        <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={newInventory}
                            onChange={e => setNewInventory(e.target.value)}
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl outline-none"
                            placeholder="Ej. 30"
                        />
                    </div>

                    {/* Spacer to prevent content being hidden behind keyboard/bottom area */}
                    <div className="h-32"></div>
                </div>

                <div className="pt-4 mt-auto pb-20 bg-gray-50/90 backdrop-blur-sm z-10 border-t border-slate-100">
                    <Button fullWidth type="submit" isLoading={isManualLoading}>
                        {isManualLoading ? "Procesando..." : (editingId ? "Guardar Cambios" : "Guardar Medicamento")}
                    </Button>
                    {editingId && (
                        <div className="mt-3">
                            <Button type="button" variant="ghost" fullWidth onClick={() => { resetForm(); setView('dashboard'); }}>
                                Cancelar
                            </Button>
                        </div>
                    )}
                </div>
            </form>
        </div>
    );

    const renderProfile = () => (
        <div className="pb-32 pt-6 px-4">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Historial</h1>
                <button
                    onClick={generateReport}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium active:scale-95 transition-transform"
                >
                    <Share2 size={16} />
                    <span>Reporte</span>
                </button>
            </header>

            {/* AI Analysis Section */}
            <div className="mb-8">
                {!analysisResult ? (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
                        <h3 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                            <Sparkles size={18} className="text-indigo-600" />
                            Insights con IA
                        </h3>
                        <p className="text-sm text-indigo-700/80 mb-4">
                            Analiza tu historial para descubrir patrones y mejorar tu salud.
                        </p>
                        <Button
                            variant="secondary"
                            fullWidth
                            onClick={handleAnalyzeHistory}
                            isLoading={isAnalyzing}
                            disabled={history.length === 0}
                            className="bg-white border-indigo-200 hover:bg-white/80"
                        >
                            {history.length === 0 ? "Registra medicamentos primero" : "Analizar mi progreso"}
                        </Button>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-top-4">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-slate-800">Resumen de Adherencia</h3>
                            <button onClick={() => setAnalysisResult(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
                        </div>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            {analysisResult}
                        </p>
                    </div>
                )}
            </div>

            {/* History List */}
            <div className="space-y-4">
                {history.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <History size={48} className="mx-auto mb-3 opacity-20" />
                        <p>Aún no has tomado ningún medicamento.</p>
                    </div>
                ) : (
                    history.map(log => (
                        <div key={log.id} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                <CheckCircle2 size={20} />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800">{log.medicationName}</h4>
                                <p className="text-xs text-slate-500">
                                    {new Date(log.takenAt).toLocaleDateString()} • {new Date(log.takenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    return (
        <div className="h-[100dvh] w-full max-w-md mx-auto bg-gray-50 flex flex-col relative shadow-2xl overflow-hidden">

            {/* Main Content Area */}
            <main className="flex-1 overflow-hidden relative">
                <div className="h-full overflow-y-auto no-scrollbar scroll-smooth">
                    {view === 'dashboard' && renderDashboard()}
                    {view === 'add' && renderAdd()}
                    {view === 'profile' && renderProfile()}
                </div>
            </main>

            {/* Bottom Nav */}
            <div className="absolute bottom-0 w-full z-50">
                <Navigation currentView={view} onChangeView={setView} />
            </div>

            {/* AI Modal */}
            {showAiModal && (
                <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full rounded-2xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Sparkles className="text-violet-600" size={20} />
                                Asistente Inteligente
                            </h3>
                            <button onClick={() => setShowAiModal(false)}><X className="text-slate-400" /></button>
                        </div>

                        <p className="text-slate-500 text-sm">
                            Escribe o dicta instrucciones como si hablaras con un doctor.
                            <br />
                            <span className="italic opacity-70">"Pastilla para la presión cada mañana"</span>
                        </p>

                        <textarea
                            value={aiInput}
                            onChange={e => setAiInput(e.target.value)}
                            className="w-full h-32 p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none"
                            placeholder="Escribe aquí..."
                            autoFocus
                        />

                        <Button
                            fullWidth
                            onClick={handleAiAdd}
                            isLoading={isAiLoading}
                            className="bg-violet-600 hover:bg-violet-700 shadow-violet-200"
                        >
                            Procesar y Guardar
                        </Button>
                    </div>
                </div>
            )}

        </div>
    );
};

export default App;
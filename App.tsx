import React, { useState, useEffect, useRef } from 'react';
import { Medication, View, FrequencyType, HistoryLog, Theme, UserStats } from './types';
import { Navigation } from './components/Navigation';
import { MedicationCard } from './components/MedicationCard';
import { Button } from './components/Button';
import { parseMedicationInstruction, analyzeHistory, analyzeMedicationDetails, checkSystemStatus, regenerateMedicationInfo } from './services/geminiService';
import { Sparkles, X, Search, Bell, History, CheckCircle2, Share2, HeartPulse, Palette, Clock, Trophy, Flame, Lock, Unlock, Zap, Download, AlertOctagon } from 'lucide-react';

// THEMES CONFIGURATION
const THEMES: Record<string, Theme> = {
  ocean: {
    id: 'ocean',
    name: 'Océano',
    price: 0,
    unlocked: true,
    classes: {
      bg: 'bg-slate-50',
      textMain: 'text-slate-800',
      textSec: 'text-slate-500',
      card: 'bg-white',
      cardBorder: 'border-slate-100',
      primary: 'text-blue-600',
      accent: 'bg-blue-600',
      nav: 'bg-white/90'
    }
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    price: 50,
    unlocked: false,
    classes: {
      bg: 'bg-rose-50',
      textMain: 'text-rose-950',
      textSec: 'text-rose-600/70',
      card: 'bg-white/90',
      cardBorder: 'border-rose-100',
      primary: 'text-rose-600',
      accent: 'bg-rose-500',
      nav: 'bg-white/80'
    }
  },
  dark: {
    id: 'dark',
    name: 'Modo Noche',
    price: 0,
    unlocked: true,
    classes: {
      bg: 'bg-slate-950',
      textMain: 'text-slate-100',
      textSec: 'text-slate-400',
      card: 'bg-slate-900',
      cardBorder: 'border-slate-800',
      primary: 'text-blue-400',
      accent: 'bg-blue-600',
      nav: 'bg-slate-900/90'
    }
  },
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk',
    price: 150,
    unlocked: false,
    classes: {
      bg: 'bg-gray-950',
      textMain: 'text-cyan-50',
      textSec: 'text-cyan-200/60',
      card: 'bg-gray-900/80',
      cardBorder: 'border-purple-500/30',
      primary: 'text-cyan-400',
      accent: 'bg-purple-600',
      nav: 'bg-gray-900/90'
    }
  }
};

const DEFAULT_MEDS: Medication[] = [];
const DEFAULT_STATS: UserStats = { level: 1, currentPoints: 0, streakDays: 0, achievementsUnlocked: [] };
const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-violet-500'];

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  
  // App Preferences
  const [unlockedThemes, setUnlockedThemes] = useState<string[]>(() => {
    const saved = localStorage.getItem('unlockedThemes');
    return saved ? JSON.parse(saved) : ['ocean', 'dark'];
  });
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => localStorage.getItem('theme') || 'ocean');
  const theme = THEMES[currentThemeId] || THEMES.ocean;

  // Data State
  const [medications, setMedications] = useState<Medication[]>(() => {
    const saved = localStorage.getItem('medications');
    return saved ? JSON.parse(saved) : DEFAULT_MEDS;
  });

  const [history, setHistory] = useState<HistoryLog[]>(() => {
    const saved = localStorage.getItem('history');
    return saved ? JSON.parse(saved) : [];
  });

  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('userStats');
    return saved ? JSON.parse(saved) : DEFAULT_STATS;
  });
  
  // Form State
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [systemStatus, setSystemStatus] = useState({ hasKey: true, keySource: '' });
  
  // Manual Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newFreqType, setNewFreqType] = useState<FrequencyType>(FrequencyType.DAILY);
  const [newFreqVal, setNewFreqVal] = useState('1'); 
  const [newInventory, setNewInventory] = useState('30');
  const [startTime, setStartTime] = useState('08:00'); 
  const [isManualLoading, setIsManualLoading] = useState(false);

  // Analysis State
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Notification State
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const lastCheckRef = useRef<number>(Date.now());

  // Persistence
  useEffect(() => { localStorage.setItem('medications', JSON.stringify(medications)); }, [medications]);
  useEffect(() => { localStorage.setItem('history', JSON.stringify(history)); }, [history]);
  useEffect(() => { localStorage.setItem('theme', currentThemeId); }, [currentThemeId]);
  useEffect(() => { localStorage.setItem('userStats', JSON.stringify(stats)); }, [stats]);
  useEffect(() => { localStorage.setItem('unlockedThemes', JSON.stringify(unlockedThemes)); }, [unlockedThemes]);

  // Check Status on Mount
  useEffect(() => {
    const status = checkSystemStatus();
    setSystemStatus(status);
    if (!status.hasKey) {
      console.warn("⚠️ Aplicación corriendo sin API Key. Las funciones de IA estarán deshabilitadas.");
    }
  }, []);

  // Handle Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Notifications Logic
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
         setNotificationsEnabled(true);
      }
    }

    const checkInterval = setInterval(() => {
      if (Notification.permission === 'granted') checkDueMedications();
    }, 30000); // Check every 30s
    return () => clearInterval(checkInterval);
  }, [medications]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return alert("Tu navegador no soporta notificaciones.");
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        new Notification("MediRecordatorio", { 
          body: "¡Configurado! Mantén la app en segundo plano para recibir alertas.", 
          icon: "/icon.svg" 
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const checkDueMedications = () => {
    const now = new Date();
    // Simple debounce to prevent double triggers in same minute
    if (Date.now() - lastCheckRef.current < 20000) return;
    
    medications.forEach(med => {
      if (med.nextDose) {
        const doseTime = new Date(med.nextDose);
        // Check if dose is due within last minute or future 1 minute
        const diff = doseTime.getTime() - now.getTime();
        if (Math.abs(diff) < 60000) { 
             lastCheckRef.current = Date.now();
             new Notification(`¡Hora de tu medicina!`, {
                body: `Toma: ${med.name} (${med.dosage})`,
                icon: "/icon.svg",
                tag: med.id,
                requireInteraction: true
             });
        }
      }
    });
  };

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  // CORE LOGIC
  const updateStats = (points: number) => {
    setStats(prev => {
       const today = new Date().toDateString();
       const last = prev.lastTakenDate ? new Date(prev.lastTakenDate).toDateString() : null;
       
       let newStreak = prev.streakDays;
       if (today !== last) {
         // Check if yesterday was skipped. If last was yesterday, increment. If null (first time), 1.
         const yesterday = new Date();
         yesterday.setDate(yesterday.getDate() - 1);
         if (last === yesterday.toDateString()) {
           newStreak += 1;
         } else if (last !== today) {
           newStreak = 1; // Reset or Start
         }
       }

       const newPoints = prev.currentPoints + points;
       const newLevel = Math.floor(newPoints / 100) + 1; // Simple level curve

       return {
         ...prev,
         currentPoints: newPoints,
         streakDays: newStreak,
         level: newLevel,
         lastTakenDate: new Date().toISOString()
       };
    });
  };

  const handleTakeMedication = (id: string) => {
    const medToTake = medications.find(m => m.id === id);
    if (!medToTake) return;

    // Rewards
    updateStats(10); // 10 XP per dose

    // Log History
    const newLog: HistoryLog = {
      id: crypto.randomUUID(),
      medicationName: medToTake.name,
      takenAt: new Date().toISOString(),
      status: 'taken',
      pointsEarned: 10
    };
    setHistory(prev => [newLog, ...prev]);

    // Inventory
    const currentStock = medToTake.inventory ?? 0;
    const newStock = Math.max(0, currentStock - 1);
    
    // Update Schedule STRICTLY based on previous schedule
    setMedications(prev => prev.map(med => {
      if (med.id !== id) return med;

      let baseDate = med.nextDose ? new Date(med.nextDose) : new Date();
      
      // FIX: Ensure calculation always moves forward from the scheduled time
      if (med.frequencyType === FrequencyType.HOURLY) {
        baseDate.setHours(baseDate.getHours() + med.frequencyValue);
      } else if (med.frequencyType === FrequencyType.DAILY) {
        baseDate.setDate(baseDate.getDate() + 1); // Exact same time next day
      } else if (med.frequencyType === FrequencyType.WEEKLY) {
        baseDate.setDate(baseDate.getDate() + (med.frequencyValue * 7));
      }

      // Catch-up logic: If the calculated time is STILL in the past (missed multiple days),
      // we jump to the next valid slot in the future to avoid immediate re-notification loop.
      const now = new Date();
      while (baseDate < now && med.frequencyType !== FrequencyType.AS_NEEDED) {
         if (med.frequencyType === FrequencyType.HOURLY) baseDate.setHours(baseDate.getHours() + med.frequencyValue);
         else if (med.frequencyType === FrequencyType.DAILY) baseDate.setDate(baseDate.getDate() + 1);
         else if (med.frequencyType === FrequencyType.WEEKLY) baseDate.setDate(baseDate.getDate() + 7);
      }

      return { 
        ...med, 
        nextDose: baseDate.toISOString(),
        inventory: newStock 
      };
    }));
  };

  const handleSnooze = (id: string, minutes: number) => {
    setMedications(prev => prev.map(med => {
      if (med.id !== id) return med;
      const now = new Date();
      now.setMinutes(now.getMinutes() + minutes);
      return { ...med, nextDose: now.toISOString() };
    }));
  };

  const handleDelete = (id: string) => {
    setMedications(prev => prev.filter(m => m.id !== id));
  };

  const handleRegenerate = async (id: string) => {
    const med = medications.find(m => m.id === id);
    if (!med) return;

    if (!systemStatus.hasKey) {
      alert("No se puede reparar. Falta API Key.");
      return;
    }

    const newData = await regenerateMedicationInfo(med.name);
    
    if (newData) {
      setMedications(prev => prev.map(m => {
        if (m.id === id) {
          return {
            ...m,
            name: newData.correctedName || m.name,
            description: newData.description || "Actualizado",
            advice: newData.advice
          };
        }
        return m;
      }));
      // Pequeño feedback visual o toast sería ideal, por ahora solo update
    } else {
      alert("La IA no pudo mejorar la información. Intenta más tarde.");
    }
  };

  const handleEdit = (med: Medication) => {
    setEditingId(med.id);
    setNewName(med.name);
    setNewDosage(med.dosage);
    setNewFreqType(med.frequencyType);
    setNewFreqVal(med.frequencyValue.toString());
    setNewInventory((med.inventory ?? 30).toString());
    
    const dateObj = new Date(med.nextDose || med.startDate);
    const timeStr = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
    setStartTime(timeStr);
    
    setView('add');
  };

  const resetForm = () => {
    setNewName('');
    setNewDosage('');
    setNewFreqType(FrequencyType.DAILY);
    setNewFreqVal('1');
    setNewInventory('30');
    setStartTime('08:00');
    setEditingId(null);
  };

  const handleAiAdd = async () => {
    if (!aiInput.trim()) return;
    if (!systemStatus.hasKey) {
      alert("❌ Error de Configuración: No se detectó la VITE_API_KEY. Configúrala en Vercel para usar la IA.");
      return;
    }

    setIsAiLoading(true);
    const existingMedsList = medications.map(m => m.name);
    const result = await parseMedicationInstruction(aiInput, existingMedsList);
    
    if (result && result.isValid) {
      const now = new Date();
      const newMed: Medication = {
        id: crypto.randomUUID(),
        name: result.name,
        description: result.description,
        dosage: result.dosage || 'Estándar',
        frequencyType: (result.frequencyType as FrequencyType) || FrequencyType.DAILY,
        frequencyValue: result.frequencyValue || 1,
        notes: result.info,
        startDate: now.toISOString(),
        nextDose: now.toISOString(),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        icon: 'pill',
        advice: result.advice,
        inventory: result.inventory || 20
      };
      setMedications([...medications, newMed]);
      setAiInput('');
      setShowAiModal(false);
      setView('dashboard');
    } else {
      alert(result?.info || "No pude entender la instrucción. Intenta ser más claro.");
    }
    setIsAiLoading(false);
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsManualLoading(true);

    const freqVal = parseInt(newFreqVal) || 1;
    const invVal = parseInt(newInventory) || 0;
    
    const [hours, minutes] = startTime.split(':').map(Number);
    const startDateTime = new Date();
    startDateTime.setHours(hours, minutes, 0, 0);

    if (editingId) {
      setMedications(prev => prev.map(m => {
        if (m.id === editingId) {
          const updatedNextDose = new Date();
          updatedNextDose.setHours(hours, minutes, 0, 0);
          
          return {
            ...m,
            name: newName,
            dosage: newDosage,
            frequencyType: newFreqType,
            frequencyValue: freqVal,
            inventory: invVal,
            nextDose: updatedNextDose.toISOString() 
          };
        }
        return m;
      }));
    } else {
      // Logic for NEW medication
      let details;
      
      // Si tenemos key, usamos IA. Si no, fallback manual.
      if (systemStatus.hasKey) {
         const existingMedsList = medications.map(m => m.name);
         details = await analyzeMedicationDetails(newName, existingMedsList);
      } else {
         details = { 
           isMedication: true, 
           correctedName: newName, 
           description: "Agregado manual", 
           advice: { food: "Sin datos", sideEffects: "-", interactions: "-" } 
         };
      }

      // RESTRICTION CHECK
      if (details.isMedication === false) {
        setIsManualLoading(false);
        alert(`⚠️ Bloqueado: "${newName}" no parece ser un medicamento válido.\n\nMotivo: ${details.validationMessage || "Entrada no reconocida."}`);
        return; 
      }

      const newMed: Medication = {
        id: crypto.randomUUID(),
        name: details.correctedName || newName,
        description: details.description,
        dosage: newDosage,
        frequencyType: newFreqType,
        frequencyValue: freqVal,
        startDate: startDateTime.toISOString(),
        nextDose: startDateTime.toISOString(),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        icon: 'pill',
        advice: details.advice,
        inventory: invVal
      };
      setMedications([...medications, newMed]);
    }
    
    resetForm();
    setIsManualLoading(false);
    setView('dashboard');
    if (Notification.permission === 'default') requestNotificationPermission();
  };

  const handleAnalyzeHistory = async () => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeHistory(history);
      setAnalysisResult(result || "No se pudo generar el análisis.");
    } catch (error) {
      setAnalysisResult("Error al analizar el historial.");
    }
    setIsAnalyzing(false);
  };

  const buyTheme = (t: Theme) => {
    if (stats.currentPoints >= (t.price || 0)) {
      setStats(prev => ({...prev, currentPoints: prev.currentPoints - (t.price || 0)}));
      setUnlockedThemes(prev => [...prev, t.id]);
      setCurrentThemeId(t.id);
    } else {
      alert("No tienes suficientes puntos para desbloquear este tema.");
    }
  };

  // --- RENDERS ---

  const Logo = () => (
    <div className="flex items-center gap-2">
      <div className={`p-2 rounded-xl bg-gradient-to-tr ${theme.id === 'cyber' ? 'from-cyan-400 to-blue-500 text-black' : 'from-blue-600 to-indigo-600 text-white'} shadow-lg`}>
        <HeartPulse size={20} strokeWidth={3} />
      </div>
      <div>
        <h1 className={`text-xl font-black tracking-tight ${theme.classes.textMain}`}>Medi<span className={theme.classes.primary}>Record</span></h1>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="pb-32 pt-6 px-4 space-y-6 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <Logo />
        <div className="flex gap-2">
           {installPrompt && (
              <button 
                onClick={handleInstallClick}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-600 text-white shadow-lg animate-pulse"
              >
                <Download size={14} /> Instalar
              </button>
           )}
           <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold ${theme.classes.card} border ${theme.classes.cardBorder} shadow-sm`}>
              <Flame size={14} className="text-orange-500 fill-orange-500 animate-pulse" />
              <span className={theme.classes.textMain}>{stats.streakDays}</span>
           </div>
           <button 
            onClick={requestNotificationPermission}
            className={`h-9 w-9 rounded-full flex items-center justify-center transition-all ${notificationsEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}
          >
            <Bell size={18} />
          </button>
        </div>
      </header>

      {/* ALERT BOX SI NO HAY API KEY */}
      {!systemStatus.hasKey && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3 items-start animate-pulse">
           <AlertOctagon className="text-red-500 shrink-0 mt-0.5" size={20} />
           <div>
              <h4 className="font-bold text-red-700 text-sm">Error de Configuración</h4>
              <p className="text-xs text-red-600 mt-1">
                 La <strong>VITE_API_KEY</strong> no está configurada en Vercel. La IA no funcionará. 
                 <br/><span className="opacity-75">Ve a Settings → Environment Variables en Vercel.</span>
              </p>
           </div>
        </div>
      )}

      {/* Hero Card */}
      <div className={`rounded-3xl p-6 relative overflow-hidden shadow-2xl transition-all duration-300 ${theme.id === 'cyber' ? 'bg-gradient-to-r from-purple-900 to-blue-900 border border-cyan-500/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white`}>
        <div className="relative z-10">
          <p className="opacity-80 text-sm font-medium mb-1">Nivel {stats.level} • {stats.currentPoints} XP</p>
          <div className="w-full bg-black/20 h-1.5 rounded-full mb-4 overflow-hidden">
             <div className="bg-white/90 h-full rounded-full transition-all duration-1000" style={{width: `${(stats.currentPoints % 100)}%`}}></div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {medications.length > 0 
              ? (medications.some(m => new Date(m.nextDose!).getTime() <= Date.now()) ? "Tienes dosis pendientes" : "Todo bajo control")
              : "Todo listo"}
          </h2>
          <p className="mt-1 text-sm opacity-90 font-light">
             {medications.length > 0 ? "Mantén tu racha activa." : "Añade tu primer medicamento."}
          </p>
        </div>
        <Sparkles className="absolute top-4 right-4 opacity-20 rotate-12" size={100} />
      </div>

      <div className="space-y-4">
        <h3 className={`font-bold text-lg ${theme.classes.textMain}`}>Tu Lista</h3>
        {medications.length === 0 ? (
           <div className={`text-center py-12 rounded-3xl border border-dashed ${theme.classes.card} ${theme.classes.cardBorder}`}>
             <p className={theme.classes.textSec}>Tu botiquín está vacío.</p>
           </div>
        ) : (
          medications
            .sort((a,b) => new Date(a.nextDose!).getTime() - new Date(b.nextDose!).getTime())
            .map(med => (
            <MedicationCard 
              key={med.id} 
              medication={med} 
              onTake={handleTakeMedication}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onSnooze={handleSnooze}
              onRegenerate={handleRegenerate}
              theme={theme}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderRewards = () => (
    <div className="pb-32 pt-6 px-4 space-y-6 animate-in fade-in">
       <header className="mb-6">
        <h1 className={`text-2xl font-bold ${theme.classes.textMain}`}>Logros y Tienda</h1>
        <p className={theme.classes.textSec}>Canjea tus puntos por temas visuales.</p>
      </header>

      <div className="grid grid-cols-2 gap-4">
         <div className={`p-4 rounded-2xl ${theme.classes.card} border ${theme.classes.cardBorder} flex flex-col items-center justify-center gap-2`}>
            <div className="h-12 w-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
               <Flame size={24} className="fill-current" />
            </div>
            <div className="text-center">
               <div className={`text-xl font-bold ${theme.classes.textMain}`}>{stats.streakDays} Días</div>
               <div className="text-xs text-slate-400">Racha Actual</div>
            </div>
         </div>
         <div className={`p-4 rounded-2xl ${theme.classes.card} border ${theme.classes.cardBorder} flex flex-col items-center justify-center gap-2`}>
            <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
               <Trophy size={24} className="fill-current" />
            </div>
            <div className="text-center">
               <div className={`text-xl font-bold ${theme.classes.textMain}`}>{stats.currentPoints} XP</div>
               <div className="text-xs text-slate-400">Puntos Totales</div>
            </div>
         </div>
      </div>

      <h3 className={`font-bold text-lg mt-6 ${theme.classes.textMain}`}>Tienda de Temas</h3>
      <div className="grid grid-cols-1 gap-4">
        {Object.values(THEMES).map(t => {
           const isUnlocked = unlockedThemes.includes(t.id);
           const isCurrent = currentThemeId === t.id;
           
           return (
             <button 
               key={t.id}
               disabled={isUnlocked}
               onClick={() => !isUnlocked && buyTheme(t)}
               className={`relative p-4 rounded-2xl border-2 text-left transition-all overflow-hidden group ${isCurrent ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent'} ${t.classes.card}`}
             >
               <div className={`absolute top-0 left-0 w-2 h-full ${t.classes.accent}`}></div>
               <div className="flex justify-between items-center pl-4">
                 <div>
                    <h4 className={`font-bold ${t.classes.textMain}`}>{t.name}</h4>
                    <p className={`text-xs ${t.classes.textSec}`}>{isUnlocked ? 'Desbloqueado' : `${t.price} Puntos`}</p>
                 </div>
                 <div className="h-10 w-10 flex items-center justify-center rounded-full bg-black/5">
                    {isUnlocked ? (isCurrent ? <CheckCircle2 size={20} className="text-blue-500"/> : <Unlock size={20} className="text-slate-400"/>) : <Lock size={20} className="text-slate-400 group-hover:text-slate-600"/>}
                 </div>
               </div>
             </button>
           );
        })}
      </div>
    </div>
  );

  const renderAdd = () => (
    <div className="pb-8 pt-6 px-4 h-full flex flex-col animate-in slide-in-from-bottom-4 duration-300">
       <header className="flex justify-between items-center mb-6 shrink-0">
        <h1 className={`text-2xl font-bold ${theme.classes.textMain}`}>{editingId ? 'Editar' : 'Nuevo'}</h1>
        <button onClick={() => { resetForm(); setView('dashboard'); }} className={`p-2 rounded-full ${theme.classes.textSec} hover:bg-black/5`}>
          <X size={24} />
        </button>
      </header>

      {!editingId && (
        <button 
          onClick={() => setShowAiModal(true)}
          className={`w-full p-5 rounded-2xl flex items-center justify-between mb-8 shadow-lg group transition-all active:scale-[0.98] shrink-0 ${theme.id === 'cyber' ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-fuchsia-500/20' : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-violet-200'}`}
        >
          <div className="text-left">
            <span className="flex items-center gap-2 font-bold text-lg"><Sparkles size={18} /> Usar IA</span>
            <p className="opacity-80 text-sm mt-1">Dictar o escribir rápido</p>
          </div>
          <div className="bg-white/20 p-2 rounded-full"><Search size={20} /></div>
        </button>
      )}

      <form onSubmit={handleManualAdd} className="flex flex-col flex-1 overflow-hidden">
        <div className="space-y-5 flex-1 overflow-y-auto no-scrollbar pr-1 pb-4">
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${theme.classes.textSec}`}>Medicamento</label>
              <input 
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className={`w-full p-4 rounded-xl outline-none focus:ring-2 transition-all ${theme.classes.card} ${theme.classes.cardBorder} border focus:ring-blue-500 ${theme.classes.textMain}`}
                placeholder="Ej. Acetaminofén"
              />
              {!editingId && newName.length > 3 && <p className="text-[10px] text-blue-500 mt-1 flex items-center gap-1"><Sparkles size={10}/> La IA comprobará si es válido.</p>}
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${theme.classes.textSec}`}>Hora de Inicio (Primera Dosis)</label>
              <div className={`flex items-center gap-3 p-4 rounded-xl border ${theme.classes.card} ${theme.classes.cardBorder}`}>
                <Clock className={theme.classes.primary} size={20} />
                <input 
                  type="time"
                  required
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className={`bg-transparent outline-none w-full font-bold text-lg ${theme.classes.textMain}`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className={`block text-sm font-medium mb-1.5 ${theme.classes.textSec}`}>Frecuencia</label>
                 <select 
                    value={newFreqType}
                    onChange={e => setNewFreqType(e.target.value as FrequencyType)}
                    className={`w-full p-4 rounded-xl outline-none border ${theme.classes.card} ${theme.classes.cardBorder} ${theme.classes.textMain}`}
                  >
                    <option value={FrequencyType.HOURLY}>Horas</option>
                    <option value={FrequencyType.DAILY}>Días</option>
                    <option value={FrequencyType.WEEKLY}>Semanas</option>
                  </select>
              </div>
              <div>
                <label className={`block text-sm font-medium mb-1.5 ${theme.classes.textSec}`}>Cada cuanto</label>
                <input 
                  type="number" min="1" inputMode="numeric"
                  value={newFreqVal}
                  onChange={e => setNewFreqVal(e.target.value)}
                  className={`w-full p-4 rounded-xl outline-none border ${theme.classes.card} ${theme.classes.cardBorder} ${theme.classes.textMain}`}
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${theme.classes.textSec}`}>Dosis (Opcional)</label>
              <input 
                value={newDosage}
                onChange={e => setNewDosage(e.target.value)}
                className={`w-full p-4 rounded-xl outline-none border ${theme.classes.card} ${theme.classes.cardBorder} ${theme.classes.textMain}`}
                placeholder="Ej. 500mg"
              />
            </div>
             <div>
              <label className={`block text-sm font-medium mb-1.5 ${theme.classes.textSec}`}>Stock (Pastillas)</label>
              <input 
                type="number" min="0" inputMode="numeric"
                value={newInventory}
                onChange={e => setNewInventory(e.target.value)}
                className={`w-full p-4 rounded-xl outline-none border ${theme.classes.card} ${theme.classes.cardBorder} ${theme.classes.textMain}`}
              />
            </div>
          </div>
          <div className="h-32"></div>
        </div>

        <div className={`pt-4 mt-auto pb-20 z-10 border-t backdrop-blur-md ${theme.classes.cardBorder}`}>
          <Button fullWidth type="submit" isLoading={isManualLoading} className={theme.id === 'cyber' ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/20' : ''}>
            {isManualLoading ? "Validando y Guardando..." : "Guardar Medicamento"}
          </Button>
        </div>
      </form>
    </div>
  );

  const renderProfile = () => (
    <div className="pb-32 pt-6 px-4 animate-in fade-in">
      <header className="flex justify-between items-center mb-6">
        <h1 className={`text-2xl font-bold ${theme.classes.textMain}`}>Historial</h1>
        <button onClick={generateReport} className={`p-2 rounded-lg bg-blue-50 text-blue-600`}>
          <Share2 size={20} />
        </button>
      </header>
      
      <div className="mb-8">
        {!analysisResult ? (
          <div className={`rounded-2xl p-6 border ${theme.id === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-gradient-to-br from-indigo-50 to-blue-50 border-indigo-100'}`}>
            <h3 className={`font-bold mb-2 flex items-center gap-2 ${theme.classes.textMain}`}>
              <Sparkles size={18} className="text-indigo-500"/> Insights IA
            </h3>
            <Button 
              variant="secondary" fullWidth onClick={handleAnalyzeHistory} isLoading={isAnalyzing} disabled={history.length === 0}
              className="bg-white/50 border-transparent hover:bg-white"
            >
              Analizar Progreso
            </Button>
          </div>
        ) : (
          <div className={`rounded-2xl p-6 border relative overflow-hidden animate-in slide-in-from-top-4 ${theme.classes.card} ${theme.classes.cardBorder}`}>
             <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
             <button onClick={() => setAnalysisResult(null)} className="absolute top-4 right-4 text-slate-400"><X size={16}/></button>
             <p className={`text-sm leading-relaxed ${theme.classes.textMain}`}>{analysisResult}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="text-center py-12 opacity-50"><History size={48} className="mx-auto mb-3" /><p>Sin registros.</p></div>
        ) : (
          history.map(log => (
            <div key={log.id} className={`flex items-center gap-4 p-4 rounded-xl border ${theme.classes.card} ${theme.classes.cardBorder}`}>
              <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h4 className={`font-bold ${theme.classes.textMain}`}>{log.medicationName}</h4>
                <div className="flex gap-2">
                   <p className={`text-xs ${theme.classes.textSec}`}>
                    {new Date(log.takenAt).toLocaleDateString()} • {new Date(log.takenAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  {log.pointsEarned && <span className="text-[10px] text-orange-500 font-bold">+{log.pointsEarned} XP</span>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="pb-32 pt-6 px-4 animate-in fade-in">
       <header className="mb-8">
        <h1 className={`text-2xl font-bold ${theme.classes.textMain}`}>Ajustes</h1>
        <p className={theme.classes.textSec}>Personaliza tu experiencia</p>
      </header>

      <section className="mb-8">
        <h3 className={`font-bold mb-4 flex items-center gap-2 ${theme.classes.textMain}`}>
           <Palette size={18} /> Apariencia
        </h3>
        <p className="text-xs text-slate-400 mb-2">Desbloquea más temas en la sección de Logros.</p>
        <div className="grid grid-cols-2 gap-3">
           {Object.values(THEMES).filter(t => unlockedThemes.includes(t.id)).map(t => (
             <button 
               key={t.id}
               onClick={() => setCurrentThemeId(t.id)}
               className={`p-4 rounded-xl border-2 text-left transition-all ${currentThemeId === t.id ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-transparent'} ${t.classes.card}`}
             >
               <div className={`h-8 w-8 rounded-full mb-2 ${t.classes.accent}`}></div>
               <span className={`font-medium text-sm ${t.classes.textMain}`}>{t.name}</span>
             </button>
           ))}
        </div>
      </section>

      <div className={`p-6 rounded-2xl ${theme.classes.card} border ${theme.classes.cardBorder}`}>
         <h4 className={`font-bold mb-2 ${theme.classes.textMain}`}>Sobre la App</h4>
         <p className={`text-sm ${theme.classes.textSec}`}>
           MediRecord v2.2<br/>
           Versión Gamificada
         </p>
         <div className="mt-4 pt-4 border-t text-xs text-slate-400">
           Estado IA: <span className={systemStatus.hasKey ? "text-green-500 font-bold" : "text-red-500 font-bold"}>{systemStatus.keySource}</span>
         </div>
      </div>
    </div>
  );

  const generateReport = () => {
    const report = `📋 REPORTE - MediRecordatorio\n${new Date().toLocaleDateString()}\n\n💊 Activos:\n${medications.map(m => `- ${m.name} (${m.dosage})`).join('\n')}`;
    navigator.clipboard.writeText(report).then(() => alert("Copiado!"));
    if (navigator.share) navigator.share({ title: 'Mis Medicinas', text: report }).catch(() => {});
  };

  return (
    <div className={`h-[100dvh] w-full max-w-md mx-auto flex flex-col relative shadow-2xl overflow-hidden transition-colors duration-500 ${theme.classes.bg}`}>
      
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto no-scrollbar scroll-smooth">
          {view === 'dashboard' && renderDashboard()}
          {view === 'add' && renderAdd()}
          {view === 'profile' && renderProfile()}
          {view === 'settings' && renderSettings()}
          {view === 'rewards' && renderRewards()}
        </div>
      </main>

      <div className="absolute bottom-0 w-full z-50">
        <Navigation currentView={view} onChangeView={setView} theme={theme} />
      </div>

      {showAiModal && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full rounded-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Sparkles className="text-violet-600" size={20} /> Asistente IA</h3>
              <button onClick={() => setShowAiModal(false)}><X className="text-slate-400" /></button>
            </div>
            <textarea 
              value={aiInput} onChange={e => setAiInput(e.target.value)}
              className="w-full h-32 p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none text-slate-800 no-scrollbar"
              placeholder="Ej: Tomar omeprazol en ayunas todos los días..." autoFocus
            />
            <Button fullWidth onClick={handleAiAdd} isLoading={isAiLoading} className="bg-violet-600 text-white">Procesar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
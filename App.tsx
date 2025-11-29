import React, { useState, useEffect, useRef } from 'react';
import { Medication, View, FrequencyType, HistoryLog, Theme, UserProfile } from './types';
import { Navigation } from './components/Navigation';
import { MedicationCard } from './components/MedicationCard';
import { Button } from './components/Button';
import { parseMedicationInstruction, analyzeHistory, getMedicationDetails } from './services/geminiService';
import { Sparkles, X, Search, Bell, History, CheckCircle2, Share2, HeartPulse, Palette, Clock, Trophy, Crown, Star, Flame, Target, CalendarDays, Pill, AlertCircle, PartyPopper } from 'lucide-react';

// THEMES CONFIGURATION (Same as before)
const THEMES: Record<string, Theme> = {
  ocean: {
    id: 'ocean',
    name: 'Océano',
    classes: {
      bg: 'bg-slate-50',
      textMain: 'text-slate-900',
      textSec: 'text-slate-500',
      card: 'bg-white',
      cardBorder: 'border-slate-200',
      primary: 'text-blue-600',
      accent: 'bg-blue-600',
      nav: 'bg-white/95'
    }
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    classes: {
      bg: 'bg-rose-50',
      textMain: 'text-rose-950',
      textSec: 'text-rose-600/70',
      card: 'bg-white/95',
      cardBorder: 'border-rose-100',
      primary: 'text-rose-600',
      accent: 'bg-rose-500',
      nav: 'bg-white/95'
    }
  },
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    classes: {
      bg: 'bg-slate-950',
      textMain: 'text-slate-100',
      textSec: 'text-slate-400',
      card: 'bg-slate-900',
      cardBorder: 'border-slate-800',
      primary: 'text-blue-400',
      accent: 'bg-blue-600',
      nav: 'bg-slate-900/95'
    }
  },
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk',
    classes: {
      bg: 'bg-gray-950',
      textMain: 'text-cyan-50',
      textSec: 'text-cyan-200/60',
      card: 'bg-gray-900/90',
      cardBorder: 'border-purple-500/30',
      primary: 'text-cyan-400',
      accent: 'bg-purple-600',
      nav: 'bg-gray-900/95'
    }
  }
};

const DEFAULT_MEDS: Medication[] = [];
const COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-violet-500'];

const LEVELS = [
  { level: 1, name: "Novato", xpRequired: 0 },
  { level: 2, name: "Iniciado", xpRequired: 100 },
  { level: 3, name: "Constante", xpRequired: 300 },
  { level: 4, name: "Disciplinado", xpRequired: 600 },
  { level: 5, name: "Guardián de Salud", xpRequired: 1000 },
  { level: 6, name: "Maestro Vital", xpRequired: 1500 },
  { level: 7, name: "Leyenda", xpRequired: 2500 }
];

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  
  // App Preferences
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

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('userProfile');
    return saved ? JSON.parse(saved) : { 
      xp: 0, 
      level: 1, 
      streakDays: 0, 
      lastActiveDate: new Date().toISOString().split('T')[0],
      achievements: [] 
    };
  });
  
  // Form State
  const [aiInput, setAiInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  
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
  const lastCheckRef = useRef<number>(Date.now());

  // UI States
  const [showLevelUp, setShowLevelUp] = useState<{name: string, level: number} | null>(null);

  // Persistence
  useEffect(() => {
    localStorage.setItem('medications', JSON.stringify(medications));
  }, [medications]);

  useEffect(() => {
    localStorage.setItem('history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem('theme', currentThemeId);
  }, [currentThemeId]);

  useEffect(() => {
    localStorage.setItem('userProfile', JSON.stringify(userProfile));
  }, [userProfile]);

  // Notifications Logic
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
        setNotificationsEnabled(true);
    }
    const checkInterval = setInterval(() => {
      if (Notification.permission === 'granted') checkDueMedications();
    }, 60000);
    return () => clearInterval(checkInterval);
  }, [medications]);

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) return alert("Tu navegador no soporta notificaciones.");
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
      new Notification("MediRecordatorio", { body: "¡Configurado! Te avisaremos a tiempo.", icon: "/pwa-192x192.png" });
    }
  };

  const checkDueMedications = () => {
    const now = new Date();
    if (Date.now() - lastCheckRef.current < 50000) return;
    lastCheckRef.current = Date.now();

    medications.forEach(med => {
      if (med.nextDose) {
        const doseTime = new Date(med.nextDose);
        // Only notify if we are within 1 minute of the time to avoid spam
        const diff = Math.abs(doseTime.getTime() - now.getTime());
        if (doseTime <= now && diff < 60000) {
             new Notification(`Hora de tu medicamento`, {
                body: `Es hora de tomar: ${med.name}`,
                tag: med.id 
             });
        }
      }
    });
  };

  // GAMIFICATION LOGIC
  const calculatePoints = (scheduledTimeStr: string | undefined): number => {
    if (!scheduledTimeStr) return 10;
    
    const now = new Date().getTime();
    const scheduled = new Date(scheduledTimeStr).getTime();
    const diffMinutes = Math.abs(now - scheduled) / (1000 * 60);

    if (diffMinutes <= 60) return 50; 
    if (diffMinutes <= 120) return 30; 
    return 10; 
  };

  const updateUserStats = (points: number) => {
    setUserProfile(prev => {
      let newXp = prev.xp + points;
      let newLevel = prev.level;
      
      const nextLevelData = LEVELS.find(l => l.level === prev.level + 1);
      if (nextLevelData && newXp >= nextLevelData.xpRequired) {
        newLevel = nextLevelData.level;
        setShowLevelUp({ name: nextLevelData.name, level: newLevel });
      }

      const today = new Date().toISOString().split('T')[0];
      let newStreak = prev.streakDays;
      if (today !== prev.lastActiveDate) {
        newStreak += 1;
      }

      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        streakDays: newStreak,
        lastActiveDate: today
      };
    });
  };

  const handleTakeMedication = (id: string) => {
    const medToTake = medications.find(m => m.id === id);
    if (!medToTake) return;

    const points = calculatePoints(medToTake.nextDose);
    updateUserStats(points);

    const newLog: HistoryLog = {
      id: crypto.randomUUID(),
      medicationName: medToTake.name,
      takenAt: new Date().toISOString(),
      status: 'taken',
      pointsEarned: points
    };
    setHistory(prev => [newLog, ...prev]);

    const currentStock = medToTake.inventory ?? 0;
    const newStock = Math.max(0, currentStock - 1);
    
    // --- NUEVO CÁLCULO DE FECHAS (FIXED) ---
    setMedications(prev => prev.map(med => {
      if (med.id !== id) return med;

      const now = new Date();
      let nextDate: Date;

      if (med.frequencyType === FrequencyType.HOURLY) {
        // Para intervalos por hora, calculamos desde AHORA (seguridad médica).
        // Si tenías que tomarla a las 2pm y la tomas a las 3pm, la siguiente (si es cada 8h) debe ser a las 11pm, no a las 10pm.
        nextDate = new Date(now.getTime() + (med.frequencyValue * 60 * 60 * 1000));
      } 
      else if (med.frequencyType === FrequencyType.AS_NEEDED) {
        nextDate = now; 
      }
      else {
        // Para Diario/Semanal, mantenemos la consistencia del horario original.
        // Si es a las 8am y la tomas a las 9am, la de mañana debe seguir siendo a las 8am.
        // Usamos la fecha programada anterior como base.
        const baseDate = med.nextDose ? new Date(med.nextDose) : new Date(med.startDate);
        
        // Empezamos desde la base y sumamos intervalos hasta superar la hora actual.
        // Esto corrige si el usuario se saltó varios días o se toma la pastilla muy tarde.
        nextDate = new Date(baseDate);
        
        while (nextDate <= now) {
           if (med.frequencyType === FrequencyType.DAILY) {
             nextDate.setDate(nextDate.getDate() + med.frequencyValue);
           } else if (med.frequencyType === FrequencyType.WEEKLY) {
             nextDate.setDate(nextDate.getDate() + (med.frequencyValue * 7));
           }
        }
      }

      return { 
        ...med, 
        nextDose: nextDate.toISOString(),
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

  const handleEdit = (med: Medication) => {
    setEditingId(med.id);
    setNewName(med.name);
    setNewDosage(med.dosage);
    setNewFreqType(med.frequencyType);
    setNewFreqVal(med.frequencyValue.toString());
    setNewInventory((med.inventory ?? 30).toString());
    
    const dateObj = new Date(med.startDate);
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
    setIsAiLoading(true);
    const existingMedsList = medications.map(m => m.name);
    const result = await parseMedicationInstruction(aiInput, existingMedsList);
    
    if (result) {
      const start = new Date();
      start.setMinutes(0, 0, 0); 
      
      const newMed: Medication = {
        id: crypto.randomUUID(),
        name: result.name,
        description: result.description, // Added Description
        dosage: result.dosage || 'Estándar',
        frequencyType: (result.frequencyType as FrequencyType) || FrequencyType.DAILY,
        frequencyValue: result.frequencyValue || 1,
        notes: result.info,
        startDate: start.toISOString(),
        nextDose: start.toISOString(), 
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        icon: 'pill',
        advice: result.advice,
        inventory: result.inventory || 20
      };
      setMedications([...medications, newMed]);
      setAiInput('');
      setShowAiModal(false);
      setView('dashboard');
      if (Notification.permission === 'default') requestNotificationPermission();
    } else {
      alert("No entendí la instrucción. Intenta ser más claro.");
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
          // If editing, we generally want to keep the schedule unless user changed time manually
          // For simplicity in this edit flow, we update nextDose if they changed start time
          return {
            ...m,
            name: newName,
            dosage: newDosage,
            frequencyType: newFreqType,
            frequencyValue: freqVal,
            inventory: invVal,
            startDate: startDateTime.toISOString(),
            nextDose: startDateTime.toISOString() 
          };
        }
        return m;
      }));
    } else {
      const existingMedsList = medications.map(m => m.name);
      
      // CALL NEW SERVICE TO CORRECT NAME AND GET DESCRIPTION
      const details = await getMedicationDetails(newName, existingMedsList);
      
      // Use corrected name if available, otherwise user input
      const finalName = details?.correctedName || newName;
      const finalDesc = details?.description || "Medicamento personal";

      const newMed: Medication = {
        id: crypto.randomUUID(),
        name: finalName,
        description: finalDesc,
        dosage: newDosage,
        frequencyType: newFreqType,
        frequencyValue: freqVal,
        startDate: startDateTime.toISOString(), 
        nextDose: startDateTime.toISOString(),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        icon: 'pill',
        advice: details?.advice,
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
    const result = await analyzeHistory(history);
    setAnalysisResult(result || "No se pudo realizar el análisis.");
    setIsAnalyzing(false);
  };

  // HELPERS FOR UI STYLING
  const getInputClass = () => {
    if (theme.id === 'dark' || theme.id === 'cyber') {
      return `w-full p-4 rounded-xl outline-none focus:ring-2 transition-all border bg-slate-800 border-slate-700 text-white placeholder-slate-400 focus:ring-blue-500`;
    }
    return `w-full p-4 rounded-xl outline-none focus:ring-2 transition-all border bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:ring-blue-500`;
  };
  
  const getModalClass = () => `fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in`;

  // --- RENDERS ---
  // (Rendering code remains largely similar, just ensuring scrollbars are hidden via CSS class in main container)
  
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
        <button 
          onClick={requestNotificationPermission}
          className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${notificationsEnabled ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}
        >
          <Bell size={20} />
        </button>
      </header>

      {/* Hero Card */}
      <div className={`rounded-3xl p-6 relative overflow-hidden shadow-2xl transition-all duration-300 ${theme.id === 'cyber' ? 'bg-gradient-to-r from-purple-900 to-blue-900 border border-cyan-500/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white`}>
        <div className="relative z-10">
          <p className="opacity-80 text-sm font-medium mb-1">Próxima Dosis</p>
          <h2 className="text-3xl font-bold tracking-tight truncate pr-4">
            {medications.length > 0 
              ? medications.sort((a,b) => new Date(a.nextDose!).getTime() - new Date(b.nextDose!).getTime())[0].name 
              : "Todo listo"}
          </h2>
          <div className="flex gap-4 mt-4">
            <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md">
               <Crown size={14} /> Nivel {userProfile.level}
            </div>
             <div className="flex items-center gap-1.5 bg-white/20 px-3 py-1.5 rounded-full text-xs font-medium backdrop-blur-md">
               <Star size={14} /> {userProfile.xp} XP
            </div>
          </div>
        </div>
        <Sparkles className="absolute top-4 right-4 opacity-20 rotate-12" size={100} />
      </div>

      <div className="space-y-4">
        <h3 className={`font-bold text-lg ${theme.classes.textMain}`}>Tu Lista</h3>
        {medications.length === 0 ? (
           <div className={`text-center py-12 rounded-3xl border border-dashed ${theme.classes.card} ${theme.classes.cardBorder}`}>
             <Pill size={40} className={`mx-auto mb-2 opacity-20 ${theme.classes.textMain}`} />
             <p className={theme.classes.textSec}>Tu botiquín está vacío.</p>
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
              theme={theme}
            />
          ))
        )}
      </div>
    </div>
  );

  // ... (renderAchievements and renderProfile omitted for brevity as they didn't change logic, just consumed scrollbar fix globally) ...
  const renderAchievements = () => {
      const nextLevel = LEVELS.find(l => l.level === userProfile.level + 1) || LEVELS[LEVELS.length - 1];
      const currentLevel = LEVELS.find(l => l.level === userProfile.level) || LEVELS[0];
      const progress = Math.min(100, (userProfile.xp / nextLevel.xpRequired) * 100);
  
      return (
        <div className="pb-32 pt-6 px-4 animate-in fade-in">
          <header className="mb-6">
            <h1 className={`text-2xl font-bold ${theme.classes.textMain}`}>Logros</h1>
            <p className={theme.classes.textSec}>Tu progreso de salud</p>
          </header>
  
          <div className={`p-6 rounded-3xl mb-8 relative overflow-hidden ${theme.id === 'cyber' ? 'bg-gradient-to-tr from-cyan-900 to-purple-900 border border-cyan-500/30' : 'bg-gradient-to-tr from-amber-400 to-orange-500'} text-white shadow-lg`}>
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="h-20 w-20 bg-white/20 rounded-full flex items-center justify-center mb-3 backdrop-blur-sm border border-white/30">
                <Trophy size={40} className="text-white drop-shadow-md" />
              </div>
              <h2 className="text-2xl font-bold">{currentLevel.name}</h2>
              <p className="opacity-90 text-sm font-medium mb-4">Nivel {userProfile.level}</p>
              
              <div className="w-full bg-black/20 h-3 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-white transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
              <div className="flex justify-between w-full text-xs font-semibold opacity-80">
                <span>{userProfile.xp} XP</span>
                <span>{nextLevel.xpRequired} XP</span>
              </div>
            </div>
            <Crown className="absolute -bottom-4 -right-4 opacity-10 rotate-[-15deg]" size={150} />
          </div>
  
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className={`p-4 rounded-2xl border ${theme.classes.card} ${theme.classes.cardBorder}`}>
               <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Flame size={20} /></div>
                  <span className={`text-sm font-bold ${theme.classes.textSec}`}>Racha</span>
               </div>
               <p className={`text-2xl font-black ${theme.classes.textMain}`}>{userProfile.streakDays} <span className="text-sm font-medium opacity-50">Días</span></p>
            </div>
            <div className={`p-4 rounded-2xl border ${theme.classes.card} ${theme.classes.cardBorder}`}>
               <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Target size={20} /></div>
                  <span className={`text-sm font-bold ${theme.classes.textSec}`}>Total</span>
               </div>
               <p className={`text-2xl font-black ${theme.classes.textMain}`}>{history.length} <span className="text-sm font-medium opacity-50">Tomas</span></p>
            </div>
          </div>
        </div>
      );
    };

  const renderAdd = () => (
    <div className="pb-8 pt-6 px-4 h-full flex flex-col animate-in slide-in-from-bottom-4 duration-300">
       <header className="flex justify-between items-center mb-6 shrink-0 relative">
        <h1 className={`text-2xl font-bold ${theme.classes.textMain}`}>{editingId ? 'Editar' : 'Nuevo'}</h1>
        <button onClick={() => { resetForm(); setView('dashboard'); }} className={`p-2 rounded-full ${theme.classes.textSec} hover:bg-black/5 active:scale-95 transition-transform`}>
          <X size={28} />
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
        <div className="space-y-6 flex-1 overflow-y-auto pr-1 pb-4 no-scrollbar">
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-bold mb-2 ml-1 ${theme.classes.textSec}`}>Nombre del Medicamento</label>
              <input 
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className={getInputClass()}
                placeholder="Ej. Ibuprofeno"
              />
            </div>

            <div>
              <label className={`block text-sm font-bold mb-2 ml-1 ${theme.classes.textSec}`}>Hora de Inicio</label>
              <div className={`flex items-center gap-3 ${getInputClass()} p-0 overflow-hidden relative`}>
                <div className="pl-4 absolute left-0 pointer-events-none"><Clock className={theme.classes.primary} size={20} /></div>
                <input 
                  type="time"
                  required
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className={`bg-transparent outline-none w-full font-bold text-lg h-full py-4 pl-12 ${theme.id === 'dark' || theme.id === 'cyber' ? 'text-white' : 'text-slate-900'} [color-scheme:light]`}
                />
              </div>
              <p className="text-xs text-slate-400 mt-2 ml-1">Las siguientes tomas se calcularán desde esta hora.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                 <label className={`block text-sm font-bold mb-2 ml-1 ${theme.classes.textSec}`}>Frecuencia</label>
                 <div className="relative">
                   <select 
                      value={newFreqType}
                      onChange={e => setNewFreqType(e.target.value as FrequencyType)}
                      className={`${getInputClass()} appearance-none`}
                    >
                      <option value={FrequencyType.HOURLY}>Horas</option>
                      <option value={FrequencyType.DAILY}>Días</option>
                      <option value={FrequencyType.WEEKLY}>Semanas</option>
                    </select>
                    <CalendarDays size={18} className="absolute right-4 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none" />
                 </div>
              </div>
              <div>
                <label className={`block text-sm font-bold mb-2 ml-1 ${theme.classes.textSec}`}>Intervalo</label>
                <input 
                  type="number" min="1" inputMode="numeric"
                  value={newFreqVal}
                  onChange={e => setNewFreqVal(e.target.value)}
                  className={getInputClass()}
                  placeholder="1"
                />
              </div>
            </div>

            <div>
              <label className={`block text-sm font-bold mb-2 ml-1 ${theme.classes.textSec}`}>Dosis (Opcional)</label>
              <input 
                value={newDosage}
                onChange={e => setNewDosage(e.target.value)}
                className={getInputClass()}
                placeholder="Ej. 500mg"
              />
            </div>
             <div>
              <label className={`block text-sm font-bold mb-2 ml-1 ${theme.classes.textSec}`}>Stock Actual</label>
              <input 
                type="number" min="0" inputMode="numeric"
                value={newInventory}
                onChange={e => setNewInventory(e.target.value)}
                className={getInputClass()}
                placeholder="Cantidad de pastillas"
              />
            </div>
          </div>
          <div className="h-24"></div>
        </div>

        <div className={`pt-4 mt-auto pb-20 z-10 border-t backdrop-blur-md ${theme.classes.cardBorder}`}>
          <Button fullWidth type="submit" isLoading={isManualLoading} className={`h-14 text-lg ${theme.id === 'cyber' ? 'bg-cyan-500 text-black hover:bg-cyan-400 shadow-cyan-500/20' : ''}`}>
            {isManualLoading ? "Guardando..." : "Guardar Medicamento"}
          </Button>
        </div>
      </form>
    </div>
  );

  const renderProfile = () => (
      <div className="pb-32 pt-6 px-4 animate-in fade-in">
        <header className="flex justify-between items-center mb-6">
          <h1 className={`text-2xl font-bold ${theme.classes.textMain}`}>Historial</h1>
          <button onClick={() => {
              const report = `📋 REPORTE - MediRecordatorio\n${new Date().toLocaleDateString()}\n\n💊 Activos:\n${medications.map(m => `- ${m.name} (${m.dosage})`).join('\n')}`;
              navigator.clipboard.writeText(report).then(() => alert("Copiado!"));
          }} className={`p-2 rounded-lg bg-blue-50 text-blue-600`}>
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
                <div className="flex-1">
                  <h4 className={`font-bold ${theme.classes.textMain}`}>{log.medicationName}</h4>
                  <p className={`text-xs ${theme.classes.textSec}`}>
                    {new Date(log.takenAt).toLocaleDateString()} • {new Date(log.takenAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                </div>
                {log.pointsEarned && (
                  <span className="text-xs font-bold text-amber-500">+{log.pointsEarned} XP</span>
                )}
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
          <div className="grid grid-cols-2 gap-3">
             {Object.values(THEMES).map(t => (
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
             MediRecord v2.1<br/>
             Diseño "Nano Banana"
           </p>
        </div>
      </div>
    );

  return (
    <div className={`h-[100dvh] w-full max-w-md mx-auto flex flex-col relative shadow-2xl overflow-hidden transition-colors duration-500 ${theme.classes.bg}`}>
      
      <main className="flex-1 overflow-hidden relative">
        <div className="h-full overflow-y-auto no-scrollbar scroll-smooth">
          {view === 'dashboard' && renderDashboard()}
          {view === 'add' && renderAdd()}
          {view === 'profile' && renderProfile()}
          {view === 'achievements' && renderAchievements()}
          {view === 'settings' && renderSettings()}
        </div>
      </main>

      <div className="absolute bottom-0 w-full z-50">
        <Navigation currentView={view} onChangeView={setView} theme={theme} />
      </div>

      {showLevelUp && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden animate-in zoom-in-50 duration-300 max-w-sm w-full">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500"></div>
            <div className="mx-auto w-24 h-24 bg-yellow-100 rounded-full flex items-center justify-center mb-4 text-yellow-600 animate-bounce">
               <Trophy size={48} />
            </div>
            <h2 className="text-3xl font-black text-slate-800 mb-2">¡NIVEL SUBIDO!</h2>
            <p className="text-slate-500 mb-6">Ahora eres un</p>
            <div className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white font-bold text-xl py-3 px-6 rounded-xl shadow-lg shadow-orange-200 transform rotate-1 mb-8 inline-block">
              {showLevelUp.name}
            </div>
            <div className="flex justify-center gap-2 text-sm text-slate-400 mb-6">
              <PartyPopper className="text-yellow-500" />
              <span>Nivel {showLevelUp.level} desbloqueado</span>
              <PartyPopper className="text-yellow-500" />
            </div>
            <Button fullWidth onClick={() => { setShowLevelUp(null); setView('achievements'); }}>
              Ver mis Logros
            </Button>
          </div>
        </div>
      )}

      {showAiModal && (
        <div className={getModalClass()}>
          <div className="bg-white w-full rounded-3xl p-6 space-y-4 shadow-2xl animate-in slide-in-from-bottom-10 border border-slate-100 relative">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800"><Sparkles className="text-violet-600" size={20} /> Asistente IA</h3>
              <button onClick={() => setShowAiModal(false)} className="p-2 -mr-2 text-slate-400 hover:text-slate-600"><X /></button>
            </div>
            <textarea 
              value={aiInput} onChange={e => setAiInput(e.target.value)}
              className="w-full h-32 p-4 bg-slate-50 rounded-xl border border-slate-200 focus:ring-2 focus:ring-violet-500 outline-none resize-none text-slate-800 text-base"
              placeholder="Ej: Tomar omeprazol en ayunas todos los días..." autoFocus
            />
            <Button fullWidth onClick={handleAiAdd} isLoading={isAiLoading} className="bg-violet-600 text-white hover:bg-violet-700">Procesar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
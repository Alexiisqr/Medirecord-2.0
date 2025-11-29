import React, { useState } from 'react';
import { Clock, Check, Trash2, AlertCircle, Utensils, Zap, AlertTriangle, ChevronDown, ChevronUp, Edit2, Timer, Package, Info, RefreshCw, Sparkles } from 'lucide-react';
import { Medication, FrequencyType, Theme } from '../types';

interface MedicationCardProps {
  medication: Medication;
  onTake: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (med: Medication) => void;
  onSnooze: (id: string, minutes: number) => void;
  onRegenerate: (id: string) => void; // Nueva prop
  theme: Theme;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medication, onTake, onDelete, onEdit, onSnooze, onRegenerate, theme }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRegenerating(true);
    await onRegenerate(medication.id);
    setIsRegenerating(false);
  };

  const getFrequencyText = () => {
    switch (medication.frequencyType) {
      case FrequencyType.HOURLY: return `Cada ${medication.frequencyValue} h`;
      case FrequencyType.DAILY: return `${medication.frequencyValue} / día`;
      case FrequencyType.WEEKLY: return `Cada ${medication.frequencyValue} sem`;
      case FrequencyType.AS_NEEDED: return `Si necesario`;
      default: return '';
    }
  };

  const isDue = () => {
    if (!medication.nextDose) return true;
    return new Date(medication.nextDose).getTime() <= new Date().getTime();
  };

  const due = isDue();
  const hasExtendedInfo = !!medication.advice || !!medication.notes;
  const inventory = medication.inventory ?? 0;
  const lowStock = inventory <= 5 && inventory > 0;
  const noStock = inventory === 0;

  // Detección de estado de error en la descripción
  const isErrorState = 
    medication.description?.includes("Sin conexión") || 
    medication.description?.includes("Modo Offline") || 
    medication.description?.includes("Error");

  const isDark = theme.id === 'dark' || theme.id === 'cyber';

  return (
    <div className={`relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ${theme.classes.card} border ${theme.classes.cardBorder} shadow-sm group`}>
      {/* Decorative gradient bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${medication.color} opacity-80`}></div>
      
      <div className="flex justify-between items-start pl-3">
        <div className="flex-1 pr-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={`text-lg font-bold leading-tight ${theme.classes.textMain}`}>{medication.name}</h3>
            {lowStock && <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full border border-orange-500/20"><AlertTriangle size={10} /> {inventory}</span>}
            {noStock && <span className="flex items-center gap-1 text-[10px] font-bold bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20"><AlertCircle size={10} /> Agotado</span>}
          </div>
          
          {/* Descripción con opción de reparación */}
          <div className="flex items-center gap-2 mt-1">
            {medication.description && (
              <p className={`text-xs italic opacity-80 ${isErrorState ? 'text-red-500 font-bold' : theme.classes.primary} flex items-center gap-1`}>
                <Info size={10} /> {medication.description}
              </p>
            )}
            
            {isErrorState && (
              <button 
                onClick={handleRegenerateClick}
                disabled={isRegenerating}
                className="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold hover:bg-blue-200 transition-colors animate-in fade-in"
              >
                {isRegenerating ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {isRegenerating ? 'Reparando...' : 'Reparar Info'}
              </button>
            )}
          </div>

          <p className={`text-sm font-medium mt-1 ${theme.classes.textSec}`}>{medication.dosage}</p>
        </div>
        <div className="flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(medication); }}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:bg-white/10 hover:text-white' : 'text-slate-300 hover:bg-slate-100 hover:text-blue-500'}`}
          >
            <Edit2 size={16} />
          </button>
           <button 
            onClick={(e) => { e.stopPropagation(); if(confirm('¿Eliminar este medicamento?')) onDelete(medication.id); }}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'text-slate-500 hover:bg-white/10 hover:text-red-400' : 'text-slate-300 hover:bg-red-50 hover:text-red-500'}`}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-3 mt-3">
        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${isDark ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
          <Clock size={10} />
          {getFrequencyText()}
        </span>
      </div>

      {hasExtendedInfo && (
        <div className="pl-3 mt-1">
          <button 
            onClick={() => setShowDetails(!showDetails)}
            className={`text-xs font-medium flex items-center gap-1 hover:underline mt-2 ${theme.classes.primary}`}
          >
            {showDetails ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
            {showDetails ? 'Ocultar info' : 'Ver detalles y notas'}
          </button>
          
          {showDetails && (
            <div className={`mt-2 p-3 rounded-xl border space-y-2 text-xs animate-in slide-in-from-top-2 duration-200 ${isDark ? 'bg-blue-900/20 border-blue-500/20 text-blue-100' : 'bg-blue-50/50 border-blue-100 text-slate-700'}`}>
              
              {medication.notes && (
                 <div className="flex gap-2 items-start">
                     <AlertCircle size={14} className="text-indigo-500 mt-0.5 shrink-0" />
                     <div><span className={`font-semibold ${isDark ? 'text-indigo-300' : 'text-indigo-900'}`}>Nota:</span> {medication.notes}</div>
                 </div>
              )}

              {medication.advice?.food && (
                  <div className="flex gap-2 items-start">
                     <Utensils size={14} className="text-blue-500 mt-0.5 shrink-0" />
                     <div><span className={`font-semibold ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>Alimentos:</span> {medication.advice.food}</div>
                  </div>
              )}

              {medication.advice?.interactions && (
                  <div className="flex gap-2 items-start">
                     <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                     <div><span className={`font-semibold ${isDark ? 'text-amber-300' : 'text-amber-900'}`}>Interacciones:</span> {medication.advice.interactions}</div>
                  </div>
              )}
               
               {medication.advice?.sideEffects && (
                  <div className="flex gap-2 items-start">
                     <Zap size={14} className="text-purple-500 mt-0.5 shrink-0" />
                     <div><span className={`font-semibold ${isDark ? 'text-purple-300' : 'text-purple-900'}`}>Efectos:</span> {medication.advice.sideEffects}</div>
                  </div>
              )}

            </div>
          )}
        </div>
      )}

      {due ? (
        <div className="flex gap-2 mt-4 mx-2">
           <button 
            onClick={() => onSnooze(medication.id, 30)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-medium active:scale-95 transition-all ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Timer size={16} />
            <span className="text-xs">30m</span>
          </button>
          <button 
            onClick={() => onTake(medication.id)}
            disabled={noStock}
            className={`flex-[2] flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold active:scale-95 transition-all shadow-lg ${noStock ? 'bg-slate-400 cursor-not-allowed opacity-50' : (theme.id === 'cyber' ? 'bg-cyan-400 text-black shadow-cyan-400/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/30')}`}
          >
            <Check size={16} />
            {noStock ? 'Sin Stock' : 'Tomar'}
          </button>
        </div>
      ) : (
        <div className={`mt-4 mx-2 py-2 text-center text-xs font-medium rounded-xl border ${isDark ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
          Próxima: {new Date(medication.nextDose!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      )}
    </div>
  );
};
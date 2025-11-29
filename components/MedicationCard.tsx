import React, { useState } from 'react';
import { Pill, Clock, Check, Trash2, AlertCircle, Utensils, Zap, AlertTriangle, ChevronDown, ChevronUp, Edit2, Timer, Package } from 'lucide-react';
import { Medication, FrequencyType } from '../types';

interface MedicationCardProps {
  medication: Medication;
  onTake: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (med: Medication) => void;
  onSnooze: (id: string, minutes: number) => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medication, onTake, onDelete, onEdit, onSnooze }) => {
  const [showAdvice, setShowAdvice] = useState(false);

  const getFrequencyText = () => {
    switch (medication.frequencyType) {
      case FrequencyType.HOURLY: return `Cada ${medication.frequencyValue} horas`;
      case FrequencyType.DAILY: return `${medication.frequencyValue} vez al día`;
      case FrequencyType.WEEKLY: return `Cada ${medication.frequencyValue} semanas`;
      case FrequencyType.AS_NEEDED: return `Si es necesario`;
      default: return '';
    }
  };

  const isDue = () => {
    if (!medication.nextDose) return true;
    return new Date(medication.nextDose).getTime() <= new Date().getTime();
  };

  const due = isDue();
  const hasAdvice = !!medication.advice;
  const inventory = medication.inventory ?? 0;
  const lowStock = inventory <= 5 && inventory > 0;
  const noStock = inventory === 0;

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1.5 h-full ${medication.color}`}></div>
      
      <div className="flex justify-between items-start pl-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-slate-800 leading-tight">{medication.name}</h3>
            {lowStock && <span className="flex items-center gap-1 text-[10px] font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full"><AlertTriangle size={10} /> Quedan {inventory}</span>}
            {noStock && <span className="flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded-full"><AlertCircle size={10} /> Agotado</span>}
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">{medication.dosage}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onEdit(medication);
            }}
            className="p-2 text-slate-300 hover:text-blue-500 transition-colors"
          >
            <Edit2 size={18} />
          </button>
           <button 
            onClick={(e) => {
              e.stopPropagation();
              if(confirm('¿Eliminar este medicamento?')) onDelete(medication.id);
            }}
            className="p-2 text-slate-300 hover:text-red-500 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-2">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-xs font-semibold text-slate-600 border border-slate-100">
          <Clock size={12} />
          {getFrequencyText()}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${lowStock ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
          <Package size={12} />
          Stock: {inventory}
        </span>
        {medication.notes && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-50 text-xs font-semibold text-yellow-700 border border-yellow-100 truncate max-w-[150px]">
            <AlertCircle size={12} />
            {medication.notes}
          </span>
        )}
      </div>

      {hasAdvice && (
        <div className="pl-2 mt-1">
          <button 
            onClick={() => setShowAdvice(!showAdvice)}
            className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline"
          >
            {showAdvice ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            {showAdvice ? 'Ocultar recomendaciones' : 'Ver riesgos y recomendaciones'}
          </button>
          
          {showAdvice && (
            <div className="mt-3 p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2 text-sm text-slate-700 animate-in slide-in-from-top-2 duration-200">
              <div className="flex gap-2 items-start">
                 <Utensils size={16} className="text-blue-500 mt-0.5 shrink-0" />
                 <div><span className="font-semibold text-blue-900">Alimentos:</span> {medication.advice?.food}</div>
              </div>
              <div className="flex gap-2 items-start">
                 <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                 <div><span className="font-semibold text-amber-900">Interacciones:</span> {medication.advice?.interactions}</div>
              </div>
              <div className="flex gap-2 items-start">
                 <Zap size={16} className="text-purple-500 mt-0.5 shrink-0" />
                 <div><span className="font-semibold text-purple-900">Efectos:</span> {medication.advice?.sideEffects}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {due ? (
        <div className="flex gap-2 mt-2 mx-2">
           <button 
            onClick={() => onSnooze(medication.id, 15)}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-600 py-2.5 rounded-xl font-medium active:scale-95 transition-all hover:bg-slate-200"
          >
            <Timer size={18} />
            <span className="text-xs sm:text-sm">Posponer 15m</span>
          </button>
          <button 
            onClick={() => onTake(medication.id)}
            disabled={noStock}
            className={`flex-[2] flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium active:scale-95 transition-all shadow-md ${noStock ? 'bg-slate-300 text-white shadow-none cursor-not-allowed' : 'bg-blue-600 text-white shadow-blue-200'}`}
          >
            <Check size={18} />
            {noStock ? 'Sin Stock' : 'Tomar Ahora'}
          </button>
        </div>
      ) : (
        <div className="mt-2 mx-2 py-2.5 text-center text-sm text-slate-400 font-medium bg-slate-50 rounded-xl border border-slate-100">
          Próxima: {new Date(medication.nextDose!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
        </div>
      )}
    </div>
  );
};
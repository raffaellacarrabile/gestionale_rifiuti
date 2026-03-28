import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  Settings, 
  PlusCircle, 
  Trash2, 
  Download, 
  Upload, 
  AlertTriangle,
  Search,
  CheckCircle2,
  X,
  Leaf
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  generaDateRitiro, 
  separaDatabase, 
  validaMateriali, 
  formattaMateriali, 
  contaPrenotazioni,
  LIMITI
} from './services/engine';
import { caricaDatabase, salvaDatabase, caricaConfig, salvaConfig } from './services/storage';
import { generaDocumentoWord } from './services/wordService';
import { importaDaDocx } from './services/importService';
import { Prenotazione, TipologiaRifiuto, Config } from './types';
import { cn } from './lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie
} from 'recharts';

export default function App() {
  const [db, setDb] = useState<Prenotazione[]>([]);
  const [config, setConfig] = useState<Config>(caricaConfig());
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prenota' | 'attive' | 'storico' | 'settings'>('prenota');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    utente: '',
    via: '',
    telefono: '',
    materiali: '',
    note: '',
    dataRitiro: '',
    tipologia: 'Ingombranti' as TipologiaRifiuto
  });

  const [alertVietati, setAlertVietati] = useState(false);

  useEffect(() => {
    setDb(caricaDatabase());
  }, []);

  useEffect(() => {
    salvaDatabase(db);
  }, [db]);

  useEffect(() => {
    salvaConfig(config);
  }, [config]);

  const { attive, storico } = useMemo(() => separaDatabase(db), [db]);
  const dateDisponibili = useMemo(() => generaDateRitiro(config.dateExtra), [config.dateExtra]);

  // Selezione automatica prima data disponibile
  useEffect(() => {
    const findFirstAvailable = () => {
      for (const d of dateDisponibili) {
        if (d === "Data Extra") return d;
        const count = contaPrenotazioni(db, d, formData.tipologia);
        if (count < LIMITI[formData.tipologia]) return d;
      }
      return dateDisponibili[0];
    };

    const firstAvailable = findFirstAvailable();
    if (firstAvailable && formData.dataRitiro !== firstAvailable) {
      setFormData(prev => ({ ...prev, dataRitiro: firstAvailable }));
    }
  }, [formData.tipologia, dateDisponibili, db]);

  const handleUpdateField = (id: string, field: keyof Prenotazione, value: string) => {
    setDb(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleAddPrenotazione = (e: React.FormEvent) => {
    e.preventDefault();
    
    const count = contaPrenotazioni(db, formData.dataRitiro, formData.tipologia);
    const limite = LIMITI[formData.tipologia];

    if (formData.dataRitiro !== "Data Extra" && count >= limite) {
      alert(`Limite raggiunto per questa data e tipologia (${limite} slot)`);
      return;
    }

    const nuova: Prenotazione = {
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      materiali: formattaMateriali(formData.materiali),
      dataPrenotazione: format(new Date(), 'dd/MM/yyyy HH:mm')
    };

    setDb([...db, nuova]);
    setFormData({
      utente: '',
      via: '',
      telefono: '',
      materiali: '',
      note: '',
      dataRitiro: '',
      tipologia: 'Ingombranti'
    });
    setAlertVietati(false);
    setActiveTab('attive');
  };

  const handleMaterialiChange = (val: string) => {
    setFormData({ ...formData, materiali: val });
    setAlertVietati(validaMateriali(val, config.materialiVietati));
  };

  const handleDelete = (id: string) => {
    if (confirm('Sei sicuro di voler eliminare questa prenotazione?')) {
      setDb(db.filter(p => p.id !== id));
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await importaDaDocx(file);
      const dataRitiro = prompt("Inserisci la data di ritiro per questi record (DD/MM/YYYY):");
      const tipologia = prompt("Inserisci la tipologia (Ingombranti/Potature):") as TipologiaRifiuto;

      if (!dataRitiro || !tipologia) return;

      const nuove: Prenotazione[] = data.map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        utente: item.utente || 'Sconosciuto',
        via: item.via || 'N/D',
        telefono: item.telefono || 'N/D',
        materiali: formattaMateriali(item.materiali || ''),
        note: 'Importato da Word',
        dataRitiro: dataRitiro,
        tipologia: tipologia,
        dataPrenotazione: format(new Date(), 'dd/MM/yyyy HH:mm')
      }));

      setDb([...db, ...nuove]);
      alert(`Importati ${nuove.length} record con successo.`);
    } catch (error) {
      console.error(error);
      alert("Errore durante l'importazione.");
    }
  };

  const statsData = useMemo(() => {
    const counts = attive.reduce((acc, p) => {
      acc[p.tipologia] = (acc[p.tipologia] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { name: 'Ingombranti', value: counts['Ingombranti'] || 0, color: '#10b981' },
      { name: 'Potature', value: counts['Potature'] || 0, color: '#34d399' }
    ];
  }, [attive]);

  const chartData = useMemo(() => {
    const dates = dateDisponibili.filter(d => d !== "Data Extra");
    return dates.map(d => ({
      date: d,
      Ingombranti: contaPrenotazioni(db, d, 'Ingombranti'),
      Potature: contaPrenotazioni(db, d, 'Potature'),
    }));
  }, [db, dateDisponibili]);

  const groupedPrenotazioni = useMemo(() => {
    const target = activeTab === 'attive' ? attive : storico;
    const groups: Record<string, Record<TipologiaRifiuto, Prenotazione[]>> = {};
    
    target.forEach(p => {
      if (!groups[p.dataRitiro]) {
        groups[p.dataRitiro] = { Ingombranti: [], Potature: [] };
      }
      groups[p.dataRitiro][p.tipologia].push(p);
    });
    
    return groups;
  }, [activeTab, attive, storico]);

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300 bg-gray-50 text-gray-900"
    )}>
      {/* Simple Top Nav */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <Leaf className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-sm">Offida Ritiri</span>
          </div>
          
          <div className="flex gap-1">
            <button 
              onClick={() => setActiveTab('prenota')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'prenota' ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Nuova Prenotazione
            </button>
            <button 
              onClick={() => setActiveTab('attive')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'attive' ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Ritiri Attivi
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'dashboard' ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Statistiche
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-bold transition-all",
                activeTab === 'settings' ? "bg-emerald-600 text-white" : "text-gray-500 hover:bg-gray-100"
              )}
            >
              Impostazioni
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Stats Card */}
                  <div className={cn(
                    "lg:col-span-2 p-8 rounded-[32px] border relative overflow-hidden bg-white border-gray-200 shadow-sm"
                  )}>
                    <div className="relative z-10">
                      <h2 className="text-3xl font-bold tracking-tight mb-2">Comune di Offida - Analytics</h2>
                      <p className="text-sm opacity-60 mb-8 max-w-md">Monitoraggio in tempo reale della capacità di smaltimento e delle prenotazioni attive.</p>
                      
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, opacity: 0.5 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, opacity: 0.5 }} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: 'none', 
                                borderRadius: '12px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                              }} 
                            />
                            <Bar dataKey="Ingombranti" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Potature" fill="#059669" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {/* Decorative background glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 blur-[100px] rounded-full -mr-32 -mt-32" />
                  </div>

                  {/* Quick Info */}
                  <div className={cn(
                    "p-8 rounded-[32px] border flex flex-col justify-between bg-white border-gray-200 shadow-sm"
                  )}>
                    <div>
                      <div className="w-12 h-12 bg-emerald-600/10 rounded-2xl flex items-center justify-center mb-6">
                        <Search className="text-emerald-600" />
                      </div>
                      <h3 className="text-xl font-bold mb-2">Stato Sistema</h3>
                      <p className="text-sm opacity-60 mb-6">Tutti i motori di calcolo sono operativi. Database sincronizzato.</p>
                      
                      <div className="space-y-4">
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-emerald-600/5 border border-emerald-600/10">
                          <span className="text-sm font-medium">Attive</span>
                          <span className="text-xl font-bold text-emerald-600">{attive.length}</span>
                        </div>
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-blue-600/5 border border-blue-600/10">
                          <span className="text-sm font-medium">Storico</span>
                          <span className="text-xl font-bold text-blue-600">{storico.length}</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveTab('prenota')}
                      className="mt-8 w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-600/20"
                    >
                      Nuova Prenotazione
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard title="Slot Ingombranti" value={`${attive.filter(p => p.tipologia === 'Ingombranti').length}`} icon={<LayoutDashboard />} color="blue" />
                  <StatCard title="Slot Potature" value={`${attive.filter(p => p.tipologia === 'Potature').length}`} icon={<Leaf />} color="emerald" />
                  <StatCard title="Prossimo Ritiro" value={dateDisponibili[0]} icon={<Calendar />} color="blue" />
                  <StatCard title="Materiali Vietati" value={`${config.materialiVietati.length}`} icon={<AlertTriangle />} color="orange" />
                </div>
              </motion.div>
            )}

            {activeTab === 'prenota' && (
              <motion.div 
                key="prenota"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-3xl mx-auto"
              >
                <div className={cn(
                  "p-10 rounded-[40px] border bg-white border-gray-200 shadow-xl"
                )}>
                  <h2 className="text-3xl font-bold mb-8 flex items-center gap-3">
                    <PlusCircle className="text-emerald-600" />
                    Nuova Prenotazione
                  </h2>

                  <form onSubmit={handleAddPrenotazione} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InputGroup label="Nominativo Utente" value={formData.utente} onChange={v => setFormData({...formData, utente: v})} placeholder="Mario Rossi" required />
                      <InputGroup label="Telefono" value={formData.telefono} onChange={v => setFormData({...formData, telefono: v})} placeholder="333 1234567" required />
                    </div>
                    
                    <InputGroup label="Indirizzo Completo" value={formData.via} onChange={v => setFormData({...formData, via: v})} placeholder="Via Roma 1, Milano" required />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1">Tipologia Rifiuto</label>
                        <div className="flex gap-2">
                          {[
                            { id: 'Ingombranti', color: 'bg-blue-600 border-blue-600 shadow-blue-600/20' },
                            { id: 'Potature', color: 'bg-emerald-600 border-emerald-600 shadow-emerald-600/20' }
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setFormData({...formData, tipologia: t.id as TipologiaRifiuto})}
                              className={cn(
                                "flex-1 py-3 rounded-xl font-semibold transition-all border",
                                formData.tipologia === t.id 
                                  ? `${t.color} text-white shadow-lg` 
                                  : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-600"
                              )}
                            >
                              {t.id}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1">Data Ritiro</label>
                        <select 
                          value={formData.dataRitiro}
                          onChange={(e) => setFormData({...formData, dataRitiro: e.target.value})}
                          required
                          className={cn(
                            "w-full p-3 rounded-xl border appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-600/50 bg-gray-100 border-gray-200"
                          )}
                        >
                          <option value="">Seleziona una data...</option>
                          {dateDisponibili.map(d => {
                            const count = d === "Data Extra" ? 0 : contaPrenotazioni(db, d, formData.tipologia);
                            const limite = LIMITI[formData.tipologia];
                            const isFull = d !== "Data Extra" && count >= limite;
                            return (
                              <option key={d} value={d}>
                                {d} {d !== "Data Extra" ? `(${count}/${limite})` : ''} {isFull ? '- PIENO' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1 flex justify-between">
                        Materiali (uno per riga)
                        {alertVietati && <span className="text-orange-600 flex items-center gap-1"><AlertTriangle size={12} /> Materiale non conforme!</span>}
                      </label>
                      <textarea 
                        value={formData.materiali}
                        onChange={(e) => handleMaterialiChange(e.target.value)}
                        placeholder="Es:&#10;Divano&#10;Frigorifero"
                        rows={4}
                        required
                        className={cn(
                          "w-full p-4 rounded-2xl border focus:outline-none focus:ring-2 transition-all bg-gray-100 border-gray-200",
                          alertVietati ? "border-orange-600/50 ring-orange-600/20" : "focus:ring-emerald-600/50"
                        )}
                      />
                    </div>

                    <InputGroup label="Note Aggiuntive" value={formData.note} onChange={v => setFormData({...formData, note: v})} placeholder="Citofono guasto, lasciare fuori..." />

                    <button 
                      type="submit"
                      className={cn(
                        "w-full py-5 text-white font-bold rounded-2xl transition-all shadow-xl flex items-center justify-center gap-2",
                        formData.tipologia === 'Ingombranti' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"
                      )}
                    >
                      <CheckCircle2 size={20} />
                      Conferma Prenotazione
                    </button>
                  </form>
                </div>
              </motion.div>
            )}

            {(activeTab === 'attive' || activeTab === 'storico') && (
              <motion.div 
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-bold">{activeTab === 'attive' ? 'Ritiri Attivi' : 'Storico Prenotazioni'}</h2>
                    <p className="opacity-50">Gestione dei record {activeTab === 'attive' ? 'futuri e odierni' : 'passati'}.</p>
                  </div>
                  {activeTab === 'attive' && (
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 font-semibold text-sm cursor-pointer">
                        <Upload size={16} /> Importa Word
                        <input type="file" accept=".docx" className="hidden" onChange={handleImport} />
                      </label>
                      <button 
                        onClick={() => {
                          const data = prompt("Inserisci la data (DD/MM/YYYY):");
                          if (data) generaDocumentoWord(attive.filter(p => p.dataRitiro === data && p.tipologia === 'Ingombranti'), 'Ingombranti', data);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 font-semibold text-sm"
                      >
                        <Download size={16} /> Export Ingombranti
                      </button>
                      <button 
                        onClick={() => {
                          const data = prompt("Inserisci la data (DD/MM/YYYY):");
                          if (data) generaDocumentoWord(attive.filter(p => p.dataRitiro === data && p.tipologia === 'Potature'), 'Potature', data);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-all shadow-lg shadow-amber-600/20 font-semibold text-sm"
                      >
                        <Download size={16} /> Export Potature
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-12">
                  {Object.entries(groupedPrenotazioni).map(([data, types]) => (
                    <div key={data} className="space-y-6">
                      <h3 className="text-2xl font-bold flex items-center gap-2 border-b border-emerald-500/20 pb-2">
                        <Calendar className="text-emerald-500" />
                        Data Ritiro: {data}
                      </h3>
                      
                      {Object.entries(types).map(([tipo, list]) => (
                        list.length > 0 && (
                          <div key={tipo} className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className={cn(
                                "text-sm font-bold uppercase tracking-widest flex items-center gap-2",
                                tipo === 'Ingombranti' ? "text-blue-600" : "text-emerald-600"
                              )}>
                                {tipo === 'Ingombranti' ? <LayoutDashboard size={16} /> : <Leaf size={16} />}
                                {tipo} ({list.length}/{LIMITI[tipo as TipologiaRifiuto]})
                              </h4>
                              <button 
                                onClick={() => generaDocumentoWord(list, tipo as TipologiaRifiuto, data)}
                                className={cn(
                                  "text-[10px] uppercase font-bold flex items-center gap-1 px-3 py-1 rounded-lg text-white transition-all",
                                  tipo === 'Ingombranti' ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
                                )}
                              >
                                <Download size={12} /> Export {tipo}
                              </button>
                            </div>

                            <div className={cn(
                              "overflow-x-auto rounded-3xl border bg-white border-gray-200 shadow-sm"
                            )}>
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className={cn(
                                    "border-b text-[10px] uppercase tracking-widest font-bold opacity-50 border-gray-100"
                                  )}>
                                    <th className="p-4">Utente</th>
                                    <th className="p-4">Via</th>
                                    <th className="p-4">Telefono</th>
                                    <th className="p-4">Materiali</th>
                                    <th className="p-4">Note</th>
                                    <th className="p-4 w-10"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((p) => (
                                    <tr key={p.id} className={cn(
                                      "border-b last:border-0 group transition-colors border-gray-50 hover:bg-gray-50/50"
                                    )}>
                                      <td className="p-2">
                                        <input 
                                          value={p.utente} 
                                          onChange={(e) => handleUpdateField(p.id, 'utente', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded focus:bg-emerald-600/5 focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input 
                                          value={p.via} 
                                          onChange={(e) => handleUpdateField(p.id, 'via', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded focus:bg-emerald-600/5 focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input 
                                          value={p.telefono} 
                                          onChange={(e) => handleUpdateField(p.id, 'telefono', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded focus:bg-emerald-600/5 focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <textarea 
                                          value={p.materiali} 
                                          onChange={(e) => handleUpdateField(p.id, 'materiali', e.target.value)}
                                          rows={1}
                                          className="w-full bg-transparent p-2 rounded focus:bg-emerald-600/5 focus:outline-none focus:ring-1 focus:ring-emerald-600/30 resize-none"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input 
                                          value={p.note} 
                                          onChange={(e) => handleUpdateField(p.id, 'note', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded focus:bg-emerald-600/5 focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-4">
                                        <button 
                                          onClick={() => handleDelete(p.id)}
                                          className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  ))}

                  {Object.keys(groupedPrenotazioni).length === 0 && (
                    <div className={cn(
                      "p-20 rounded-[32px] border border-dashed flex flex-col items-center justify-center opacity-30 border-gray-300"
                    )}>
                      <Search size={48} className="mb-4" />
                      <p className="text-xl font-medium">Nessun record trovato</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="max-w-2xl space-y-8"
              >
                <div className={cn(
                  "p-8 rounded-[32px] border bg-white border-gray-200 shadow-sm"
                )}>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Calendar className="text-emerald-600" />
                    Date Extra Straordinarie
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="DD/MM/YYYY" 
                        id="new-extra-date"
                        className={cn(
                          "flex-1 p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-600/50 bg-gray-100 border-gray-200"
                        )}
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('new-extra-date') as HTMLInputElement;
                          if (input.value) {
                            setConfig({...config, dateExtra: [...config.dateExtra, input.value]});
                            input.value = '';
                          }
                        }}
                        className="px-6 bg-emerald-600 text-white font-bold rounded-xl"
                      >
                        Aggiungi
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {config.dateExtra.map(d => (
                        <span key={d} className="px-3 py-1 bg-emerald-600/10 text-emerald-600 rounded-lg text-sm font-bold flex items-center gap-2">
                          {d}
                          <X size={14} className="cursor-pointer" onClick={() => setConfig({...config, dateExtra: config.dateExtra.filter(x => x !== d)})} />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "p-8 rounded-[32px] border bg-white border-gray-200 shadow-sm"
                )}>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Trash2 className="text-red-600" />
                    Manutenzione Database
                  </h3>
                  <div className="p-6 rounded-2xl bg-red-50 border border-red-100">
                    <p className="text-sm text-red-800 mb-4 font-medium">
                      Attenzione: questa azione cancellerà permanentemente tutte le prenotazioni (attive e storiche).
                    </p>
                    <button 
                      onClick={() => {
                        if (confirm("Sei sicuro di voler cancellare TUTTE le prenotazioni? L'azione è irreversibile.")) {
                          setDb([]);
                          localStorage.removeItem('prenotazioni_offida');
                        }
                      }}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-600/20"
                    >
                      Svuota Database
                    </button>
                  </div>
                </div>

                <div className={cn(
                  "p-8 rounded-[32px] border bg-white border-gray-200 shadow-sm"
                )}>
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <AlertTriangle className="text-orange-600" />
                    Materiali Vietati
                  </h3>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Nome materiale..." 
                        id="new-forbidden"
                        className={cn(
                          "flex-1 p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-600/50 bg-gray-100 border-gray-200"
                        )}
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('new-forbidden') as HTMLInputElement;
                          if (input.value) {
                            setConfig({...config, materialiVietati: [...config.materialiVietati, input.value.toLowerCase()]});
                            input.value = '';
                          }
                        }}
                        className="px-6 bg-emerald-600 text-white font-bold rounded-xl"
                      >
                        Aggiungi
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {config.materialiVietati.map(m => (
                        <span key={m} className="px-3 py-1 bg-orange-600/10 text-orange-600 rounded-lg text-sm font-bold flex items-center gap-2">
                          {m}
                          <X size={14} className="cursor-pointer" onClick={() => setConfig({...config, materialiVietati: config.materialiVietati.filter(x => x !== m)})} />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: 'emerald' | 'blue' | 'orange' }) {
  const colors = {
    emerald: "bg-emerald-600/10 text-emerald-600 border-emerald-600/20",
    blue: "bg-blue-600/10 text-blue-600 border-blue-600/20",
    orange: "bg-orange-600/10 text-orange-600 border-orange-600/20"
  };

  return (
    <div className={cn(
      "p-6 rounded-[32px] border bg-white border-gray-200 shadow-sm"
    )}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 border", colors[color])}>
        {React.cloneElement(icon as React.ReactElement, { size: 20 })}
      </div>
      <p className="text-xs font-bold uppercase tracking-widest opacity-40 mb-1">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function InputGroup({ label, value, onChange, placeholder, required, type = "text" }: { label: string, value: string, onChange: (v: string) => void, placeholder: string, required?: boolean, type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider opacity-50 ml-1">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={cn(
          "w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-600/50 transition-all bg-gray-100 border-gray-200"
        )}
      />
    </div>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Calendar, 
  History, 
  Settings, 
  PlusCircle, 
  Trash2, 
  Download, 
  Upload, 
  AlertTriangle,
  Moon,
  Sun,
  Search,
  CheckCircle2,
  XCircle,
  Menu,
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
import { caricaDatabase, salvaDatabase, caricaConfig, salvaConfig, parseCSV } from './services/storage';
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
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

  const getCapacityStatus = (count: number, limit: number) => {
    if (count >= limit) return { color: 'text-red-600', label: 'PIENO', dot: 'bg-red-600' };
    if (count >= limit * 0.8) return { color: 'text-yellow-600', label: 'QUASI PIENO', dot: 'bg-yellow-600' };
    return { color: 'text-green-600', label: 'LIBERO', dot: 'bg-green-600' };
  };

  const handleAddPrenotazione = (e: React.FormEvent) => {
    e.preventDefault();
    
    const count = contaPrenotazioni(db, formData.dataRitiro, formData.tipologia);
    const limite = LIMITI[formData.tipologia];

    if (formData.dataRitiro !== "Data Extra" && count >= limite) {
      if (!confirm(`Attenzione: il limite per questa data (${limite} slot) è stato raggiunto. Vuoi comunque forzare l'inserimento?`)) {
        return;
      }
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

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const nuove = parseCSV(content);
        setDb([...db, ...nuove]);
        alert(`Importati ${nuove.length} record dal CSV con successo.`);
      } catch (error) {
        console.error(error);
        alert("Errore durante l'importazione del CSV.");
      }
    };
    reader.readAsText(file);
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
      "min-h-screen flex transition-colors duration-300 bg-slate-50 text-slate-900"
    )}>
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out border-r bg-white border-slate-200 shadow-xl",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex flex-col h-full bg-gradient-to-b from-white to-slate-50">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-600/30">
              <Leaf className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight text-slate-800">Comune di Offida</h1>
              <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Gestione Ritiri</p>
            </div>
          </div>

          <nav className="space-y-2 flex-1">
            <SidebarItem 
              icon={<LayoutDashboard size={20} />} 
              label="Home" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarItem 
              icon={<PlusCircle size={20} />} 
              label="Nuova Prenotazione" 
              active={activeTab === 'prenota'} 
              onClick={() => setActiveTab('prenota')} 
            />
            <SidebarItem 
              icon={<Calendar size={20} />} 
              label="Ritiri Attivi" 
              active={activeTab === 'attive'} 
              onClick={() => setActiveTab('attive')} 
            />
            <SidebarItem 
              icon={<History size={20} />} 
              label="Storico" 
              active={activeTab === 'storico'} 
              onClick={() => setActiveTab('storico')} 
            />
            <SidebarItem 
              icon={<Settings size={20} />} 
              label="Impostazioni" 
              active={activeTab === 'settings'} 
              onClick={() => setActiveTab('settings')} 
            />
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 bg-slate-50/50",
        sidebarOpen ? "ml-64" : "ml-0"
      )}>
        <div className="p-8 max-w-7xl mx-auto space-y-10">
          {/* Floating Menu Button when sidebar is closed */}
          {!sidebarOpen && (
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="fixed top-6 left-6 z-40 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl hover:bg-slate-50 transition-all text-emerald-600"
            >
              <Menu size={24} />
            </button>
          )}
          
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-8"
              >
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
                  <div>
                    <p className="text-slate-400 font-medium">Ecco il riepilogo delle attività di smaltimento per oggi.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Sistema Online</span>
                    </div>
                  </div>
                </div>

                {/* Prossimo Ritiro Card */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-3 p-10 rounded-[48px] relative overflow-hidden bg-slate-900 shadow-2xl shadow-emerald-900/20 flex flex-col lg:flex-row items-center justify-between gap-10 border border-slate-800">
                    {/* Background Decorative Elements */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full -mr-48 -mt-48" />
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full -ml-32 -mb-32" />
                    
                    <div className="relative z-10 flex items-center gap-8">
                      <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-[32px] flex items-center justify-center shadow-xl shadow-emerald-500/40 rotate-3 hover:rotate-0 transition-transform duration-500">
                        <Calendar className="text-white w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500/80 mb-2">Prossimo Ritiro Disponibile</p>
                        <h2 className="text-5xl font-black text-white tracking-tighter">{dateDisponibili[0]}</h2>
                      </div>
                    </div>

                    <div className="relative z-10 flex flex-wrap lg:flex-nowrap gap-6 items-center w-full lg:w-auto">
                      {['Ingombranti', 'Potature'].map((tipo) => {
                        const count = contaPrenotazioni(db, dateDisponibili[0], tipo as TipologiaRifiuto);
                        const limit = LIMITI[tipo as TipologiaRifiuto];
                        const status = getCapacityStatus(count, limit);
                        const percentage = Math.min((count / limit) * 100, 100);
                        
                        return (
                          <div key={tipo} className="flex-1 min-w-[200px] p-6 rounded-[32px] bg-white/5 backdrop-blur-md border border-white/10 flex flex-col gap-4 hover:bg-white/10 transition-colors group">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-emerald-400 transition-colors">{tipo}</p>
                              <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full border", 
                                status.label === 'PIENO' ? "bg-red-500/10 text-red-500 border-red-500/20" : 
                                status.label === 'QUASI PIENO' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" : 
                                "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                              )}>
                                {status.label}
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex justify-between items-end">
                                <span className="text-2xl font-black text-white">{count}<span className="text-slate-500 text-sm font-bold ml-1">/ {limit}</span></span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Occupazione</span>
                              </div>
                              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className={cn("h-full rounded-full", 
                                    status.label === 'PIENO' ? "bg-red-500" : 
                                    status.label === 'QUASI PIENO' ? "bg-yellow-500" : 
                                    "bg-emerald-500"
                                  )} 
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
                      <button 
                        onClick={() => setActiveTab('prenota')}
                        className="w-20 h-20 bg-emerald-500 hover:bg-emerald-400 text-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-emerald-500/40 transition-all hover:scale-110 active:scale-95 group"
                        title="Nuova Prenotazione"
                      >
                        <PlusCircle size={40} className="group-hover:rotate-90 transition-transform duration-500" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Stats Card */}
                  <div className={cn(
                    "lg:col-span-2 p-10 rounded-[48px] border relative overflow-hidden bg-white border-slate-200 shadow-sm hover:shadow-xl transition-all duration-500 group"
                  )}>
                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <h2 className="text-4xl font-black tracking-tighter text-slate-900">Home Analytics</h2>
                          <p className="text-sm font-medium text-slate-400 mt-1">Capacità di smaltimento per data di ritiro.</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                            <div className="w-2 h-2 bg-blue-600 rounded-full" />
                            <span className="text-[10px] font-black text-blue-600 uppercase">Ingombranti</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                            <div className="w-2 h-2 bg-emerald-600 rounded-full" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase">Potature</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                            <XAxis 
                              dataKey="date" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 11, fontWeight: 800, fill: '#64748b' }} 
                              dy={10}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fontSize: 11, fontWeight: 800, fill: '#94a3b8' }} 
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                              contentStyle={{ 
                                backgroundColor: '#fff', 
                                border: 'none', 
                                borderRadius: '24px',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
                                padding: '20px'
                              }} 
                            />
                            <Bar dataKey="Ingombranti" fill="#3b82f6" radius={[10, 10, 0, 0]} barSize={32} />
                            <Bar dataKey="Potature" fill="#10b981" radius={[10, 10, 0, 0]} barSize={32} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                    {/* Decorative background glow */}
                    <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/5 blur-[120px] rounded-full -mr-40 -mt-40 group-hover:bg-emerald-600/10 transition-colors duration-700" />
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
                className="max-w-4xl mx-auto"
              >
                <div className={cn(
                  "p-12 rounded-[56px] border bg-white border-slate-200 shadow-2xl relative overflow-hidden"
                )}>
                  <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-blue-600 via-emerald-500 to-blue-600" />
                  
                  <div className="mb-12">
                    <h2 className="text-4xl font-black flex items-center gap-4 text-slate-900 tracking-tighter">
                      <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                        <PlusCircle className="text-emerald-600" size={32} />
                      </div>
                      Nuova Prenotazione
                    </h2>
                    <p className="text-slate-400 font-medium mt-3 ml-18">Compila i campi sottostanti per programmare un nuovo ritiro.</p>
                  </div>

                  <form onSubmit={handleAddPrenotazione} className="space-y-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <InputGroup label="Nominativo Utente" value={formData.utente} onChange={v => setFormData({...formData, utente: v})} placeholder="Mario Rossi" required />
                      <InputGroup label="Telefono" value={formData.telefono} onChange={v => setFormData({...formData, telefono: v})} placeholder="333 1234567" required />
                    </div>
                    
                    <InputGroup label="Indirizzo Completo" value={formData.via} onChange={v => setFormData({...formData, via: v})} placeholder="Via Roma 1, Milano" required />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Tipologia Rifiuto</label>
                        <div className="flex gap-3">
                          {[
                            { id: 'Ingombranti', color: 'bg-blue-600 border-blue-700 shadow-blue-600/30' },
                            { id: 'Potature', color: 'bg-emerald-600 border-emerald-700 shadow-emerald-600/30' }
                          ].map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setFormData({...formData, tipologia: t.id as TipologiaRifiuto})}
                              className={cn(
                                "flex-1 py-5 rounded-[24px] font-black transition-all border text-xs uppercase tracking-widest",
                                formData.tipologia === t.id 
                                  ? `${t.color} text-white shadow-xl scale-[1.02]` 
                                  : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-500"
                              )}
                            >
                              {t.id}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Data Ritiro</label>
                        <div className="relative">
                          <select 
                            value={formData.dataRitiro}
                            onChange={(e) => setFormData({...formData, dataRitiro: e.target.value})}
                            required
                            className={cn(
                              "w-full p-5 rounded-[24px] border appearance-none focus:outline-none focus:ring-4 focus:ring-emerald-600/10 transition-all bg-slate-50 border-slate-200 text-slate-800 font-black text-sm pr-12"
                            )}
                          >
                            <option value="">Seleziona una data...</option>
                            {dateDisponibili.map(d => {
                              const count = d === "Data Extra" ? 0 : contaPrenotazioni(db, d, formData.tipologia);
                              const limite = LIMITI[formData.tipologia];
                              const status = getCapacityStatus(count, limite);
                              return (
                                <option key={d} value={d} className={d !== "Data Extra" ? status.color : ""}>
                                  {d} {d !== "Data Extra" ? `(${count}/${limite}) - ${status.label}` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                            <Calendar size={20} />
                          </div>
                        </div>
                        <div className="flex gap-5 mt-3 text-[10px] font-black uppercase tracking-widest opacity-70 justify-center">
                          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></span> Libero</div>
                          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 shadow-sm shadow-yellow-500/50"></span> Quasi Pieno</div>
                          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></span> Pieno</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1 flex justify-between items-center">
                        Materiali (uno per riga)
                        {alertVietati && (
                          <motion.span 
                            initial={{ x: 10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            className="text-orange-600 flex items-center gap-2 bg-orange-50 px-3 py-1 rounded-full border border-orange-100"
                          >
                            <AlertTriangle size={14} /> Materiale non conforme!
                          </motion.span>
                        )}
                      </label>
                      <textarea 
                        value={formData.materiali}
                        onChange={(e) => handleMaterialiChange(e.target.value)}
                        placeholder="Es:&#10;Divano&#10;Frigorifero"
                        rows={5}
                        required
                        className={cn(
                          "w-full p-6 rounded-[32px] border focus:outline-none focus:ring-4 transition-all bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-300 font-bold leading-relaxed",
                          alertVietati ? "border-orange-500 ring-orange-500/10" : "focus:ring-emerald-600/10"
                        )}
                      />
                    </div>

                    <InputGroup label="Note Aggiuntive" value={formData.note} onChange={v => setFormData({...formData, note: v})} placeholder="Citofono guasto, lasciare fuori..." />

                    <motion.button 
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      type="submit"
                      className={cn(
                        "w-full py-6 text-white font-black uppercase tracking-[0.3em] rounded-[28px] transition-all shadow-2xl flex items-center justify-center gap-4 text-sm",
                        formData.tipologia === 'Ingombranti' ? "bg-blue-600 hover:bg-blue-700 shadow-blue-600/40" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/40"
                      )}
                    >
                      <CheckCircle2 size={24} />
                      Conferma Prenotazione
                    </motion.button>
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
                                tipo === 'Ingombranti' ? "text-blue-700" : "text-emerald-700"
                              )}>
                                {tipo === 'Ingombranti' ? <LayoutDashboard size={16} /> : <Leaf size={16} />}
                                {tipo} - {data} ({list.length}/{LIMITI[tipo as TipologiaRifiuto]})
                                {data !== "Data Extra" && (
                                  <span className={cn("w-2.5 h-2.5 rounded-full shadow-sm", getCapacityStatus(list.length, LIMITI[tipo as TipologiaRifiuto]).dot)} />
                                )}
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
                              "overflow-x-auto rounded-3xl border bg-white border-slate-200 shadow-md"
                            )}>
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className={cn(
                                    "border-b text-[10px] uppercase tracking-widest font-black text-slate-400 border-slate-100 bg-slate-50/50"
                                  )}>
                                    <th className="p-4">Utente</th>
                                    <th className="p-4">Via</th>
                                    <th className="p-4">Telefono</th>
                                    <th className="p-4">Data Ritiro</th>
                                    <th className="p-4">Tipologia</th>
                                    <th className="p-4">Materiali</th>
                                    <th className="p-4">Note</th>
                                    <th className="p-4 w-10"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((p) => (
                                    <tr key={p.id} className={cn(
                                      "border-b last:border-0 group transition-colors border-slate-50 hover:bg-slate-50/80"
                                    )}>
                                      <td className="p-2">
                                        <input 
                                          value={p.utente} 
                                          onChange={(e) => handleUpdateField(p.id, 'utente', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded font-bold text-slate-800 focus:bg-white focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input 
                                          value={p.via} 
                                          onChange={(e) => handleUpdateField(p.id, 'via', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded text-slate-600 font-medium focus:bg-white focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input 
                                          value={p.telefono} 
                                          onChange={(e) => handleUpdateField(p.id, 'telefono', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded text-slate-600 font-medium focus:bg-white focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <select 
                                          value={p.dataRitiro}
                                          onChange={(e) => handleUpdateField(p.id, 'dataRitiro', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded text-slate-600 font-bold focus:bg-white focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600/30 appearance-none"
                                        >
                                          {dateDisponibili.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td className="p-2">
                                        <select 
                                          value={p.tipologia}
                                          onChange={(e) => handleUpdateField(p.id, 'tipologia', e.target.value)}
                                          className={cn(
                                            "w-full bg-transparent p-2 rounded font-black text-[10px] uppercase tracking-widest focus:bg-white focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600/30 appearance-none",
                                            p.tipologia === 'Ingombranti' ? "text-blue-600" : "text-emerald-600"
                                          )}
                                        >
                                          <option value="Ingombranti">Ingombranti</option>
                                          <option value="Potature">Potature</option>
                                        </select>
                                      </td>
                                      <td className="p-2">
                                        <textarea 
                                          value={p.materiali} 
                                          onChange={(e) => handleUpdateField(p.id, 'materiali', e.target.value)}
                                          rows={1}
                                          className="w-full bg-transparent p-2 rounded text-slate-600 font-medium focus:bg-white focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600/30 resize-none"
                                        />
                                      </td>
                                      <td className="p-2">
                                        <input 
                                          value={p.note} 
                                          onChange={(e) => handleUpdateField(p.id, 'note', e.target.value)}
                                          className="w-full bg-transparent p-2 rounded text-slate-500 italic font-medium focus:bg-white focus:shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-600/30"
                                        />
                                      </td>
                                      <td className="p-4">
                                        <button 
                                          onClick={() => handleDelete(p.id)}
                                          className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
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
                      "p-20 rounded-[40px] border border-dashed flex flex-col items-center justify-center bg-white/50 border-slate-300 text-slate-400"
                    )}>
                      <Search size={64} className="mb-6 opacity-20" />
                      <p className="text-2xl font-black uppercase tracking-widest opacity-40">Nessun record trovato</p>
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
                  "p-8 rounded-[40px] border bg-white border-slate-200 shadow-xl"
                )}>
                  <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-800">
                    <Upload className="text-blue-600" size={24} />
                    Importazione Dati
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex items-center justify-center gap-3 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl hover:bg-slate-100 transition-all cursor-pointer group">
                      <div className="w-12 h-12 bg-slate-200 rounded-2xl flex items-center justify-center group-hover:bg-slate-300 transition-all">
                        <Upload className="text-slate-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-800">Importa CSV</p>
                        <p className="text-xs text-slate-400">Carica file .csv</p>
                      </div>
                      <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                    </label>
                    
                    <label className="flex items-center justify-center gap-3 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl hover:bg-slate-100 transition-all cursor-pointer group">
                      <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center group-hover:bg-indigo-200 transition-all">
                        <Upload className="text-indigo-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-800">Importa Word</p>
                        <p className="text-xs text-slate-400">Carica file .docx</p>
                      </div>
                      <input type="file" accept=".docx" className="hidden" onChange={handleImport} />
                    </label>
                  </div>
                </div>

                <div className={cn(
                  "p-8 rounded-[40px] border bg-white border-slate-200 shadow-xl"
                )}>
                  <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-800">
                    <Calendar className="text-emerald-600" size={24} />
                    Date Extra Straordinarie
                  </h3>
                  <div className="space-y-6">
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        placeholder="DD/MM/YYYY" 
                        id="new-extra-date"
                        className={cn(
                          "flex-1 p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all bg-slate-50 border-slate-200 text-slate-700 font-medium"
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
                        className="px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-600/30 text-xs"
                      >
                        Aggiungi
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {config.dateExtra.map(d => (
                        <span key={d} className="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
                          {d}
                          <X size={16} className="cursor-pointer hover:text-red-500 transition-colors" onClick={() => setConfig({...config, dateExtra: config.dateExtra.filter(x => x !== d)})} />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "p-8 rounded-[40px] border bg-white border-slate-200 shadow-xl"
                )}>
                  <h3 className="text-xl font-black mb-6 flex items-center gap-3 text-slate-800">
                    <AlertTriangle className="text-orange-600" size={24} />
                    Materiali Vietati
                  </h3>
                  <div className="space-y-6">
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        placeholder="Nome materiale..." 
                        id="new-forbidden"
                        className={cn(
                          "flex-1 p-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all bg-slate-50 border-slate-200 text-slate-700 font-medium"
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
                        className="px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-600/30 text-xs"
                      >
                        Aggiungi
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {config.materialiVietati.map(m => (
                        <span key={m} className="px-4 py-2 bg-orange-50 text-orange-700 border border-orange-100 rounded-xl text-sm font-bold flex items-center gap-2 shadow-sm">
                          {m}
                          <X size={16} className="cursor-pointer hover:text-red-500 transition-colors" onClick={() => setConfig({...config, materialiVietati: config.materialiVietati.filter(x => x !== m)})} />
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm",
        active 
          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 scale-[1.02]" 
          : "text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: 'emerald' | 'blue' | 'orange' }) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shadow-emerald-500/5",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20 shadow-blue-500/5",
    orange: "bg-orange-500/10 text-orange-600 border-orange-500/20 shadow-orange-500/5"
  };

  return (
    <motion.div 
      whileHover={{ y: -5, scale: 1.02 }}
      className={cn(
        "p-8 rounded-[40px] border bg-white border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300"
      )}
    >
      <div className={cn("w-14 h-14 rounded-[20px] flex items-center justify-center mb-6 border shadow-inner", colors[color])}>
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <p className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400 mb-2">{title}</p>
      <p className="text-4xl font-black text-slate-900 tracking-tight">{value}</p>
    </motion.div>
  );
}

function InputGroup({ label, value, onChange, placeholder, required, type = "text" }: { label: string, value: string, onChange: (v: string) => void, placeholder: string, required?: boolean, type?: string }) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className={cn(
          "w-full p-3.5 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-emerald-600/20 transition-all bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-300 font-medium"
        )}
      />
    </div>
  );
}

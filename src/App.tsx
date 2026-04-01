import React, { useState, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'sonner';
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
  Leaf,
  FileText,
  GripVertical,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  generaDateRitiro, 
  separaDatabase, 
  validaMateriali, 
  formattaMateriali, 
  contaPrenotazioni,
  LIMITI
} from './services/engine';
import { 
  fetchDatabase, 
  updateDatabase, 
  deleteFromDatabase,
  fetchConfig, 
  updateConfig, 
  parseCSV 
} from './services/storage';
import { isSupabaseConfigured } from './lib/supabase';
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
  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr === "Data Extra") return new Date(8640000000000000); // Max date
    const [d, m, y] = dateStr.split('/').map(Number);
    return new Date(y, m - 1, d);
  };

  const [db, setDb] = useState<Prenotazione[]>([]);
  const [config, setConfig] = useState<Config>({
    dateExtra: [],
    materialiVietati: ['macerie', 'vernice', 'batteria', 'eternit', 'pneumatici'],
    limiti: {
      Ingombranti: 10,
      Potature: 5
    }
  });
  const [loading, setLoading] = useState(true);

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
    const init = async () => {
      try {
        const [initialDb, initialConfig] = await Promise.all([
          fetchDatabase(),
          fetchConfig()
        ]);
        setDb(initialDb);
        setConfig(initialConfig);
        if (isSupabaseConfigured) {
          toast.success("Connesso a Supabase con successo!");
        }
      } catch (error) {
        console.error('Failed to initialize data:', error);
        toast.error("Errore nel caricamento dei dati. Controlla la connessione o le chiavi Supabase.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (db.length > 0) {
      updateDatabase(db);
    }
  }, [db]);

  useEffect(() => {
    updateConfig(config);
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

  const handleUpdateField = (id: string, field: keyof Prenotazione, value: any) => {
    setDb(prev => {
      const updated = prev.map(p => p.id === id ? { ...p, [field]: value } : p);
      if (field === 'dataRitiro') {
        return updated.sort((a, b) => {
          const dateA = parseDate(a.dataRitiro);
          const dateB = parseDate(b.dataRitiro);
          return dateA.getTime() - dateB.getTime();
        });
      }
      return updated;
    });
  };

  const getCapacityStatus = (count: number, limit: number) => {
    if (count >= limit) return { color: 'text-red-600', label: 'PIENO', dot: 'bg-red-600' };
    if (count >= limit * 0.8) return { color: 'text-yellow-600', label: 'QUASI PIENO', dot: 'bg-yellow-600' };
    return { color: 'text-green-600', label: 'LIBERO', dot: 'bg-green-600' };
  };

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingPrenotazione, setPendingPrenotazione] = useState<Prenotazione | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importForm, setImportForm] = useState({ dataRitiro: '', tipologia: 'Ingombranti' as TipologiaRifiuto });

  const handleAddPrenotazione = (e: React.FormEvent) => {
    e.preventDefault();
    
    const count = contaPrenotazioni(db, formData.dataRitiro, formData.tipologia);
    const limite = LIMITI[formData.tipologia];

    const nuova: Prenotazione = {
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      materiali: formattaMateriali(formData.materiali),
      dataPrenotazione: format(new Date(), 'dd/MM/yyyy HH:mm')
    };

    if (formData.dataRitiro !== "Data Extra" && count >= limite) {
      setPendingPrenotazione(nuova);
      setShowConfirmModal(true);
      return;
    }

    confirmPrenotazione(nuova);
  };

  const confirmPrenotazione = (prenotazione: Prenotazione) => {
    const newDb = [...db, prenotazione].sort((a, b) => {
      const dateA = parseDate(a.dataRitiro);
      const dateB = parseDate(b.dataRitiro);
      return dateA.getTime() - dateB.getTime();
    });
    setDb(newDb);
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
    setShowConfirmModal(false);
    setPendingPrenotazione(null);
    toast.success("Prenotazione inserita con successo!");
  };

  const handleMaterialiChange = (val: string) => {
    setFormData({ ...formData, materiali: val });
    setAlertVietati(validaMateriali(val, config.materialiVietati));
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteId) {
      await deleteFromDatabase(pendingDeleteId);
      setDb(db.filter(p => p.id !== pendingDeleteId));
      setShowDeleteModal(false);
      setPendingDeleteId(null);
      toast.success("Prenotazione eliminata.");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await importaDaDocx(file);
      setImportData(data);
      setShowImportModal(true);
    } catch (error) {
      console.error(error);
      toast.error("Errore durante l'importazione.");
    }
  };

  const confirmImport = () => {
    if (!importForm.dataRitiro || !importForm.tipologia) {
      toast.error("Inserisci tutti i dati richiesti.");
      return;
    }

    const nuove: Prenotazione[] = importData.map(item => ({
      id: Math.random().toString(36).substr(2, 9),
      utente: item.utente || 'Sconosciuto',
      via: item.via || 'N/D',
      telefono: item.telefono || 'N/D',
      materiali: formattaMateriali(item.materiali || ''),
      note: 'Importato da Word',
      dataRitiro: importForm.dataRitiro,
      tipologia: importForm.tipologia,
      dataPrenotazione: format(new Date(), 'dd/MM/yyyy HH:mm')
    }));

    const newDb = [...db, ...nuove].sort((a, b) => {
      const dateA = parseDate(a.dataRitiro);
      const dateB = parseDate(b.dataRitiro);
      return dateA.getTime() - dateB.getTime();
    });

    setDb(newDb);
    setShowImportModal(false);
    setImportData([]);
    toast.success(`Importati ${nuove.length} record con successo.`);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const nuove = parseCSV(content);
        const newDb = [...db, ...nuove].sort((a, b) => {
          const dateA = parseDate(a.dataRitiro);
          const dateB = parseDate(b.dataRitiro);
          return dateA.getTime() - dateB.getTime();
        });
        setDb(newDb);
        toast.success(`Importati ${nuove.length} record dal CSV con successo.`);
      } catch (error) {
        console.error(error);
        toast.error("Errore durante l'importazione del CSV.");
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = attive.findIndex(p => p.id === active.id);
      const newIndex = attive.findIndex(p => p.id === over.id);
      
      const newAttive = arrayMove(attive, oldIndex, newIndex);
      // Reconstruct the full database preserving the new order of active bookings
      setDb([...newAttive, ...storico]);
    }
  };

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
    const groupsMap = new Map<string, Record<TipologiaRifiuto, Prenotazione[]>>();
    
    target.forEach(p => {
      if (!groupsMap.has(p.dataRitiro)) {
        groupsMap.set(p.dataRitiro, { Ingombranti: [], Potature: [] });
      }
      groupsMap.get(p.dataRitiro)![p.tipologia].push(p);
    });
    
    return Array.from(groupsMap.entries()).sort((a, b) => {
      const dateA = parseDate(a[0]);
      const dateB = parseDate(b[0]);
      if (activeTab === 'storico') return dateB.getTime() - dateA.getTime();
      return dateA.getTime() - dateB.getTime();
    });
  }, [activeTab, attive, storico]);

  return (
    <div className={cn(
      "min-h-screen flex transition-colors duration-300 bg-slate-50 text-slate-900"
    )}>
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-black uppercase tracking-widest text-xs">Caricamento dati...</p>
          </motion.div>
        )}
      </AnimatePresence>

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
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-widest text-emerald-600 font-bold">Gestione Ritiri</p>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isSupabaseConfigured ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                )} title={isSupabaseConfigured ? "Cloud Sincronizzato" : "Solo Locale"} />
              </div>
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
                    <h2 className="text-4xl font-black tracking-tighter text-slate-900">Dashboard Overview</h2>
                    <p className="text-slate-400 font-medium">Riepilogo delle prenotazioni attive e stato del sistema.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">Sistema Online</span>
                    </div>
                  </div>
                </div>

                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-8 rounded-[40px] bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                    <div className="w-14 h-14 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20">
                      <Calendar size={28} />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Totale Ritiri Attivi</p>
                    <p className="text-4xl font-black text-slate-900">{attive.length}</p>
                    <div className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600">
                      <span>Prossimo: {dateDisponibili[0]}</span>
                      <ArrowRight size={14} />
                    </div>
                  </div>

                  <div className="p-8 rounded-[40px] bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                    <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                      <LayoutDashboard size={28} />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Ingombranti</p>
                    <p className="text-4xl font-black text-slate-900">{attive.filter(p => p.tipologia === 'Ingombranti').length}</p>
                    <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 rounded-full" 
                        style={{ width: `${(attive.filter(p => p.tipologia === 'Ingombranti').length / (attive.length || 1)) * 100}%` }} 
                      />
                    </div>
                  </div>

                  <div className="p-8 rounded-[40px] bg-white border border-slate-200 shadow-sm hover:shadow-xl transition-all group">
                    <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20">
                      <Leaf size={28} />
                    </div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-1">Potature</p>
                    <p className="text-4xl font-black text-slate-900">{attive.filter(p => p.tipologia === 'Potature').length}</p>
                    <div className="mt-4 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full" 
                        style={{ width: `${(attive.filter(p => p.tipologia === 'Potature').length / (attive.length || 1)) * 100}%` }} 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Recent Activity */}
                  <div className="lg:col-span-2 p-10 rounded-[48px] bg-white border border-slate-200 shadow-sm">
                    <h3 className="text-2xl font-black tracking-tighter text-slate-900 mb-6">Ultime Prenotazioni Attive</h3>
                    <div className="space-y-4">
                      {attive.slice(0, 5).map((p) => (
                        <div key={p.id} className="flex items-center justify-between p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:border-emerald-200 transition-all group">
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm",
                              p.tipologia === 'Ingombranti' ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                            )}>
                              {p.tipologia === 'Ingombranti' ? <LayoutDashboard size={20} /> : <Leaf size={20} />}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{p.utente}</p>
                              <p className="text-xs text-slate-400 font-medium">{p.via} • {p.telefono}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">{p.dataRitiro}</p>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{p.tipologia}</p>
                          </div>
                        </div>
                      ))}
                      {attive.length === 0 && (
                        <div className="py-20 text-center">
                          <p className="text-slate-400 font-medium">Nessuna prenotazione attiva al momento.</p>
                        </div>
                      )}
                    </div>
                    {attive.length > 5 && (
                      <button 
                        onClick={() => setActiveTab('attive')}
                        className="mt-6 w-full py-4 border-2 border-dashed border-slate-200 rounded-3xl text-slate-400 font-bold hover:border-emerald-300 hover:text-emerald-600 transition-all"
                      >
                        Visualizza tutte le {attive.length} prenotazioni
                      </button>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-6">
                    <div className="p-8 rounded-[40px] bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-white/20 transition-all" />
                      <h3 className="text-xl font-black mb-2 relative z-10">Nuovo Ritiro</h3>
                      <p className="text-emerald-100 text-sm mb-6 relative z-10">Inserisci velocemente una nuova prenotazione nel sistema.</p>
                      <button 
                        onClick={() => setActiveTab('prenota')}
                        className="w-full py-4 bg-white text-emerald-600 font-black rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all relative z-10"
                      >
                        VAI AL FORM
                      </button>
                    </div>

                    <div className="p-8 rounded-[40px] bg-slate-900 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden group">
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 blur-3xl rounded-full -ml-16 -mb-16 group-hover:bg-blue-500/20 transition-all" />
                      <h3 className="text-xl font-black mb-2 relative z-10">Configurazione</h3>
                      <p className="text-slate-400 text-sm mb-6 relative z-10">Gestisci le date extra e i materiali vietati.</p>
                      <button 
                        onClick={() => setActiveTab('settings')}
                        className="w-full py-4 bg-slate-800 text-white font-black rounded-2xl shadow-lg hover:bg-slate-700 transition-all relative z-10"
                      >
                        IMPOSTAZIONI
                      </button>
                    </div>
                  </div>
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

            {activeTab === 'attive' && (
              <motion.div 
                key="attive"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-12"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900">Ritiri Attivi</h2>
                    <p className="text-slate-400 font-medium">Gestione separata per data e tipologia. Trascina le righe per riordinare.</p>
                  </div>
                  <div className="flex gap-3">
                    <button 
                      onClick={() => generaDocumentoWord(attive, 'Ingombranti', 'Tutti')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                    >
                      <Download size={14} /> Export Tutti Ingombranti
                    </button>
                    <button 
                      onClick={() => generaDocumentoWord(attive, 'Potature', 'Tutti')}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                    >
                      <Download size={14} /> Export Tutte Potature
                    </button>
                  </div>
                </div>

                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <div className="space-y-12">
                    {groupedPrenotazioni.map(([data, types]: [string, Record<TipologiaRifiuto, Prenotazione[]>]) => (
                      <div key={data} className="space-y-6">
                        <h3 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-800 border-b border-slate-200 pb-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Calendar className="text-emerald-600" size={20} />
                          </div>
                          Data Ritiro: {data}
                        </h3>
                        
                        {(Object.entries(types) as [TipologiaRifiuto, Prenotazione[]][]).map(([tipo, list]) => (
                          list.length > 0 && (
                            <div key={tipo} className="space-y-3">
                              <div className="flex justify-between items-center">
                                <h4 className={cn(
                                  "text-xs font-black uppercase tracking-widest flex items-center gap-2",
                                  tipo === 'Ingombranti' ? "text-blue-600" : "text-emerald-600"
                                )}>
                                  {tipo === 'Ingombranti' ? <LayoutDashboard size={14} /> : <Leaf size={14} />}
                                  {tipo} • {list.length} record
                                </h4>
                                <button 
                                  onClick={() => generaDocumentoWord(list, tipo, data)}
                                  className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                                >
                                  <Download size={10} /> Export questa lista
                                </button>
                              </div>

                              <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden">
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left border-collapse">
                                    <thead>
                                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <th className="p-3 w-8 border-r border-slate-200"></th>
                                        <th className="p-3 border-r border-slate-200">Utente</th>
                                        <th className="p-3 border-r border-slate-200">Via</th>
                                        <th className="p-3 border-r border-slate-200">Telefono</th>
                                        <th className="p-3 border-r border-slate-200">Data Ritiro</th>
                                        <th className="p-3 border-r border-slate-200">Tipologia</th>
                                        <th className="p-3 border-r border-slate-200">Materiali</th>
                                        <th className="p-3 border-r border-slate-200">Note</th>
                                        <th className="p-3 w-10"></th>
                                      </tr>
                                    </thead>
                                    <SortableContext 
                                      items={list.map(p => p.id)}
                                      strategy={verticalListSortingStrategy}
                                    >
                                      <tbody>
                                        {list.map((p) => (
                                          <SortableRow 
                                            key={p.id} 
                                            p={p} 
                                            handleUpdateField={handleUpdateField} 
                                            handleDelete={handleDelete}
                                            dateDisponibili={dateDisponibili}
                                          />
                                        ))}
                                      </tbody>
                                    </SortableContext>
                                  </table>
                                </div>
                              </div>
                            </div>
                          )
                        ))}
                      </div>
                    ))}
                  </div>
                </DndContext>

                {attive.length === 0 && (
                  <div className="p-20 rounded-[40px] border border-dashed flex flex-col items-center justify-center bg-white/50 border-slate-300 text-slate-400">
                    <Search size={64} className="mb-6 opacity-20" />
                    <p className="text-2xl font-black uppercase tracking-widest opacity-40">Nessun record trovato</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'storico' && (
              <motion.div 
                key="storico"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900">Storico Prenotazioni</h2>
                    <p className="text-slate-400 font-medium">Archivio dei ritiri completati.</p>
                  </div>
                </div>

                <div className="space-y-12">
                  {groupedPrenotazioni.map(([data, types]: [string, Record<TipologiaRifiuto, Prenotazione[]>]) => (
                    <div key={data} className="space-y-6">
                      <h3 className="text-2xl font-black tracking-tight flex items-center gap-3 text-slate-800 border-b border-slate-200 pb-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Calendar className="text-slate-500" size={20} />
                        </div>
                        Data Ritiro: {data}
                      </h3>
                      
                      {(Object.entries(types) as [TipologiaRifiuto, Prenotazione[]][]).map(([tipo, list]) => (
                        list.length > 0 && (
                          <div key={tipo} className="space-y-3">
                            <div className="flex justify-between items-center">
                              <h4 className={cn(
                                "text-xs font-black uppercase tracking-widest flex items-center gap-2",
                                tipo === 'Ingombranti' ? "text-blue-600" : "text-emerald-600"
                              )}>
                                {tipo === 'Ingombranti' ? <LayoutDashboard size={14} /> : <Leaf size={14} />}
                                {tipo} • {list.length} record
                              </h4>
                            </div>

                            <div className="overflow-x-auto rounded-3xl border bg-white border-slate-200 shadow-sm">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <th className="p-3 border-r border-slate-100">Utente</th>
                                    <th className="p-3 border-r border-slate-100">Via</th>
                                    <th className="p-3 border-r border-slate-100">Telefono</th>
                                    <th className="p-3 border-r border-slate-100">Materiali</th>
                                    <th className="p-3">Note</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {list.map((p) => (
                                    <tr key={p.id} className="border-b last:border-0 border-slate-50 hover:bg-slate-50/50 transition-colors">
                                      <td className="p-3 border-r border-slate-50 font-bold text-slate-800 truncate">{p.utente}</td>
                                      <td className="p-3 border-r border-slate-50 text-slate-600 truncate">{p.via}</td>
                                      <td className="p-3 border-r border-slate-50 text-slate-600">{p.telefono}</td>
                                      <td className="p-3 border-r border-slate-50 text-slate-600 truncate">{p.materiali}</td>
                                      <td className="p-3 text-slate-400 italic text-xs truncate">{p.note}</td>
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

                  {groupedPrenotazioni.length === 0 && (
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
                    <LayoutDashboard className="text-blue-600" size={24} />
                    Stato Database Cloud (Supabase)
                  </h3>
                  <div className="flex items-center gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100">
                    <div className={cn(
                      "w-4 h-4 rounded-full animate-pulse",
                      isSupabaseConfigured ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-slate-300"
                    )} />
                    <div>
                      <p className="font-black text-slate-700 uppercase tracking-widest text-[10px]">
                        {isSupabaseConfigured ? "Sincronizzazione Attiva" : "Sincronizzazione Disattivata"}
                      </p>
                      <p className="text-sm text-slate-500 font-medium">
                        {isSupabaseConfigured 
                          ? "I dati sono salvati in tempo reale sul cloud." 
                          : "Configura le chiavi nelle impostazioni del progetto per attivare il cloud."}
                      </p>
                    </div>
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

          {/* Confirmation Modals */}
          <AnimatePresence>
            {showConfirmModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl border border-slate-200"
                >
                  <div className="w-20 h-20 bg-orange-100 rounded-3xl flex items-center justify-center mb-8 mx-auto">
                    <AlertTriangle className="text-orange-600" size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-center mb-4 text-slate-900 tracking-tight">Data al Limite</h3>
                  <p className="text-slate-500 text-center mb-10 font-medium leading-relaxed">
                    Attenzione: il limite per questa data è stato raggiunto. Vuoi comunque forzare l'inserimento della prenotazione?
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowConfirmModal(false)}
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest rounded-2xl transition-all text-xs"
                    >
                      Annulla
                    </button>
                    <button 
                      onClick={() => pendingPrenotazione && confirmPrenotazione(pendingPrenotazione)}
                      className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-emerald-600/30 text-xs"
                    >
                      Conferma
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {showDeleteModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl border border-slate-200"
                >
                  <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mb-8 mx-auto">
                    <AlertTriangle className="text-red-600" size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-center mb-4 text-slate-900 tracking-tight">Elimina Prenotazione</h3>
                  <p className="text-slate-500 text-center mb-10 font-medium leading-relaxed">
                    Sei sicuro di voler eliminare definitivamente questa prenotazione? L'azione non può essere annullata.
                  </p>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest rounded-2xl transition-all text-xs"
                    >
                      Annulla
                    </button>
                    <button 
                      onClick={confirmDelete}
                      className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-600/30 text-xs"
                    >
                      Elimina
                    </button>
                  </div>
                </motion.div>
              </div>
            )}

            {showImportModal && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="bg-white rounded-[40px] p-10 max-w-md w-full shadow-2xl border border-slate-200"
                >
                  <div className="w-20 h-20 bg-blue-100 rounded-3xl flex items-center justify-center mb-8 mx-auto">
                    <FileText className="text-blue-600" size={40} />
                  </div>
                  <h3 className="text-2xl font-black text-center mb-4 text-slate-900 tracking-tight">Configura Importazione</h3>
                  <p className="text-slate-500 text-center mb-8 font-medium leading-relaxed">
                    Hai caricato {importData.length} record. Specifica la data e la tipologia per completare l'importazione.
                  </p>
                  
                  <div className="space-y-6 mb-10">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Data Ritiro</label>
                      <select 
                        value={importForm.dataRitiro}
                        onChange={(e) => setImportForm({...importForm, dataRitiro: e.target.value})}
                        className="w-full p-4 rounded-2xl border bg-slate-50 border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                      >
                        <option value="">Seleziona una data...</option>
                        {dateDisponibili.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tipologia</label>
                      <div className="flex gap-2">
                        {['Ingombranti', 'Potature'].map(t => (
                          <button
                            key={t}
                            onClick={() => setImportForm({...importForm, tipologia: t as TipologiaRifiuto})}
                            className={cn(
                              "flex-1 py-3 rounded-xl font-bold border transition-all text-xs uppercase tracking-widest",
                              importForm.tipologia === t 
                                ? "bg-blue-600 text-white border-blue-700 shadow-lg" 
                                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => setShowImportModal(false)}
                      className="flex-1 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black uppercase tracking-widest rounded-2xl transition-all text-xs"
                    >
                      Annulla
                    </button>
                    <button 
                      onClick={confirmImport}
                      className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-blue-600/30 text-xs"
                    >
                      Importa
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          <Toaster position="top-right" richColors />
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

interface SortableRowProps {
  p: Prenotazione;
  handleUpdateField: (id: string, field: keyof Prenotazione, value: any) => void;
  handleDelete: (id: string) => void;
  dateDisponibili: string[];
}

const SortableRow: React.FC<SortableRowProps> = ({ 
  p, 
  handleUpdateField, 
  handleDelete, 
  dateDisponibili 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: p.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
    position: isDragging ? 'relative' as const : 'static' as const,
  };

  return (
    <tr 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "border-b group transition-colors border-slate-200 hover:bg-slate-50/80",
        isDragging && "shadow-2xl bg-white"
      )}
    >
      <td className="p-0 w-8 border-r border-slate-200 text-center">
        <button 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-2 text-slate-300 hover:text-slate-600 transition-colors"
        >
          <GripVertical size={14} />
        </button>
      </td>
      <td className="p-0 border-r border-slate-200">
        <div className="relative min-w-[120px]">
          <div className="invisible whitespace-pre-wrap p-3 font-bold break-words">{p.utente || ' '}</div>
          <textarea 
            value={p.utente} 
            onChange={(e) => handleUpdateField(p.id, 'utente', e.target.value)}
            rows={1}
            className="absolute inset-0 w-full h-full bg-transparent p-3 font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-inset focus:ring-1 focus:ring-emerald-600/30 resize-none overflow-hidden"
          />
        </div>
      </td>
      <td className="p-0 border-r border-slate-200">
        <div className="relative min-w-[150px]">
          <div className="invisible whitespace-pre-wrap p-3 font-medium break-words">{p.via || ' '}</div>
          <textarea 
            value={p.via} 
            onChange={(e) => handleUpdateField(p.id, 'via', e.target.value)}
            rows={1}
            className="absolute inset-0 w-full h-full bg-transparent p-3 text-slate-600 font-medium focus:bg-white focus:outline-none focus:ring-inset focus:ring-1 focus:ring-emerald-600/30 resize-none overflow-hidden"
          />
        </div>
      </td>
      <td className="p-0 border-r border-slate-200">
        <div className="relative min-w-[100px]">
          <div className="invisible whitespace-nowrap p-3 font-medium">{p.telefono || ' '}</div>
          <input 
            value={p.telefono} 
            onChange={(e) => handleUpdateField(p.id, 'telefono', e.target.value)}
            className="absolute inset-0 w-full h-full bg-transparent p-3 text-slate-600 font-medium focus:bg-white focus:outline-none focus:ring-inset focus:ring-1 focus:ring-emerald-600/30"
          />
        </div>
      </td>
      <td className="p-0 border-r border-slate-200">
        <div className="relative min-w-[130px]">
          <div className="invisible whitespace-nowrap p-3 font-bold">{p.dataRitiro || ' '}</div>
          <select 
            value={p.dataRitiro}
            onChange={(e) => handleUpdateField(p.id, 'dataRitiro', e.target.value)}
            className="absolute inset-0 w-full h-full bg-transparent p-3 text-slate-600 font-bold focus:bg-white focus:outline-none focus:ring-inset focus:ring-1 focus:ring-emerald-600/30 appearance-none"
          >
            {dateDisponibili.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </td>
      <td className="p-0 border-r border-slate-200">
        <div className="relative min-w-[120px]">
          <div className="invisible whitespace-nowrap p-3 font-black text-[10px] uppercase tracking-widest">{p.tipologia || ' '}</div>
          <select 
            value={p.tipologia}
            onChange={(e) => handleUpdateField(p.id, 'tipologia', e.target.value)}
            className={cn(
              "absolute inset-0 w-full h-full bg-transparent p-3 font-black text-[10px] uppercase tracking-widest focus:bg-white focus:outline-none focus:ring-inset focus:ring-1 focus:ring-emerald-600/30 appearance-none",
              p.tipologia === 'Ingombranti' ? "text-blue-600" : "text-emerald-600"
            )}
          >
            <option value="Ingombranti">Ingombranti</option>
            <option value="Potature">Potature</option>
          </select>
        </div>
      </td>
      <td className="p-0 border-r border-slate-200">
        <div className="relative min-w-[200px]">
          <div className="invisible whitespace-pre-wrap p-3 font-medium break-words">{p.materiali || ' '}</div>
          <textarea 
            value={p.materiali} 
            onChange={(e) => handleUpdateField(p.id, 'materiali', e.target.value)}
            rows={1}
            className="absolute inset-0 w-full h-full bg-transparent p-3 text-slate-600 font-medium focus:bg-white focus:outline-none focus:ring-inset focus:ring-1 focus:ring-emerald-600/30 resize-none overflow-hidden"
          />
        </div>
      </td>
      <td className="p-0 border-r border-slate-200">
        <div className="relative min-w-[150px]">
          <div className="invisible whitespace-pre-wrap p-3 italic font-medium break-words">{p.note || ' '}</div>
          <textarea 
            value={p.note} 
            onChange={(e) => handleUpdateField(p.id, 'note', e.target.value)}
            rows={1}
            className="absolute inset-0 w-full h-full bg-transparent p-3 text-slate-500 italic font-medium focus:bg-white focus:outline-none focus:ring-inset focus:ring-1 focus:ring-emerald-600/30 resize-none overflow-hidden"
          />
        </div>
      </td>
      <td className="p-0 text-center w-10">
        <button 
          onClick={() => handleDelete(p.id)}
          className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
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

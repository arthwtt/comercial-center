import React, { useState, useEffect } from 'react';
import { ShieldCheck, Server, Key, Save, Play, Unplug, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export default function ConnectionPage() {
  const [formData, setFormData] = useState({ baseURL: '', accountId: '', token: '' });
  const [status, setStatus] = useState('idle'); // idle, testing, success, error
  const [errorMsg, setErrorMsg] = useState('');
  const [agents, setAgents] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentConnection, setCurrentConnection] = useState(null);

  useEffect(() => {
    checkCurrentStatus();
  }, []);

  const checkCurrentStatus = async () => {
    try {
      const res = await api.get('/config/status');
      if (res.data.configured) {
        if (res.data.active) {
          setCurrentConnection('active');
          setFormData({
            baseURL: res.data.baseURL,
            accountId: res.data.accountId,
            token: '••••••••••••••••'
          });
        } else {
          setCurrentConnection('error');
        }
      } else {
        setCurrentConnection('none');
      }
    } catch (e) {
      setCurrentConnection('error');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setStatus('idle');
  };

  const handleTest = async () => {
    if (!formData.baseURL || !formData.accountId || !formData.token) {
      setErrorMsg('Preencha todos os campos antes de testar.');
      setStatus('error');
      return;
    }
    
    setStatus('testing');
    try {
      const res = await api.post('/config/test', formData);
      if (res.data.success) {
        setAgents(res.data.agents);
        setStatus('success');
      } else {
        throw new Error(res.data.error || "Erro desconhecido.");
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.error || err.message);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.post('/config/save', formData);
      await checkCurrentStatus();
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      alert('Erro ao salvar as configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Módulo de Conexão
          </h1>
          <p className="text-slate-400 mt-2">Configure o acesso à API do Chatwoot</p>
        </div>
        
        {currentConnection === 'active' && (
          <div className="flex items-center gap-2 bg-green-500/10 text-green-400 px-4 py-2 rounded-full border border-green-500/20">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium text-sm">Conexão Ativa</span>
          </div>
        )}
        {currentConnection === 'error' && (
          <div className="flex items-center gap-2 bg-red-500/10 text-red-400 px-4 py-2 rounded-full border border-red-500/20">
            <Unplug className="w-5 h-5" />
            <span className="font-medium text-sm">Erro de Conexão</span>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-xl">
        <div className="grid gap-6 md:grid-cols-2">
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Server className="w-4 h-4 text-blue-400" />
              Base URL (fazer.ai)
            </label>
            <input 
              type="url" 
              name="baseURL"
              value={formData.baseURL}
              onChange={handleChange}
              placeholder="https://app.fazer.ai"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-purple-400" />
               Account ID
            </label>
            <input 
              type="number" 
              name="accountId"
              value={formData.accountId}
              onChange={handleChange}
              placeholder="Ex: 1"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
               <Key className="w-4 h-4 text-amber-400" />
               API Access Token
            </label>
            <input 
              type="password" 
              name="token"
              value={formData.token}
              onChange={handleChange}
              placeholder="Profile Settings > Access Token"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-slate-200 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
            />
          </div>

        </div>

        {status === 'error' && (
          <div className="mt-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex gap-3 text-red-200">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm">{errorMsg}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="mt-6 p-5 rounded-xl bg-slate-900/50 border border-green-500/20">
            <h3 className="text-green-400 font-medium flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5" />
              Conexão efetuada com sucesso!
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              Encontramos {agents.length} agente(s) na sua conta:
            </p>
            <div className="flex flex-wrap gap-2">
              {agents.map(a => (
                <div key={a.id} className="bg-slate-800 px-3 py-1.5 rounded-lg text-xs border border-slate-700 flex items-center gap-2">
                 {a.thumbnail && <img src={a.thumbnail} alt={a.name} className="w-5 h-5 rounded-full" />}
                 {a.name}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-end gap-4">
          <button 
            onClick={handleTest}
            disabled={status === 'testing'}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {status === 'testing' ? (
              <span className="animate-spin h-5 w-5 border-2 border-slate-400 border-t-white rounded-full"></span>
            ) : <Play className="w-4 h-4" />}
            Testar Conexão
          </button>

          <button 
            onClick={handleSave}
            disabled={status !== 'success' || isSaving}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-all ${
              status === 'success' 
               ? 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-lg shadow-blue-500/20' 
               : 'bg-slate-800 text-slate-500 shadow-none hidden'
            }`}
          >
            <Save className="w-4 h-4" />
            Salvar e Aplicar
          </button>
        </div>

      </div>
    </div>
  );
}

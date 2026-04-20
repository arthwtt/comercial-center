import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, MessageCircle, Clock, CheckCircle } from 'lucide-react';

export default function KanbanCard({ conversation: task, baseUrl, accountId }) {
  // Parsing details de TASK ao invés de conversation
  let timeAgo = 'agora';
  try {
     timeAgo = formatDistanceToNow(new Date(task.updated_at), { addSuffix: true, locale: ptBR });
  } catch(e) {}
  
  const contact = task.contacts?.[0];
  const agent = task.assigned_agents?.[0];
  const conversationNode = task.conversations?.[0];

  const chatwootLink = conversationNode ? `${baseUrl}/app/accounts/${accountId}/conversations/${conversationNode.id}` : null;

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact?.name || 'Lead')}&background=0D8ABC&color=fff`;
  
  return (
    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg hover:shadow-xl hover:border-slate-500 transition-all group flex flex-col gap-3">
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <img src={contact?.avatar_url || defaultAvatar} alt="avatar" className="w-10 h-10 rounded-full border border-slate-600 object-cover" />
          <div>
            <h4 className="font-semibold text-slate-200 text-sm truncate w-32">{contact?.name || task.title || 'Desconhecido'}</h4>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              {conversationNode ? <><MessageCircle className="w-3 h-3 text-blue-400" /> Ativo</> : <><CheckCircle className="w-3 h-3 text-slate-500"/> Sem Chat</>}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
        <div className="flex items-center gap-1.5" title="Responsável">
          {agent ? (
            <>
               <span className="truncate w-20">{agent.name}</span>
            </>
          ) : (
            <span className="italic">Sem dono</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center opacity-70 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] uppercase font-bold text-slate-500 truncate w-20" title={task.title}>{task.title}</span>
        {chatwootLink ? (
            <a 
              href={chatwootLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs font-medium cursor-pointer"
            >
              Abrir 
              <ExternalLink className="w-3 h-3 inline" />
            </a>
        ) : (
            <span className="text-slate-500 text-xs flex items-center gap-1"><ExternalLink className="w-3 h-3 inline"/> Draft</span>
        )}
      </div>

    </div>
  );
}

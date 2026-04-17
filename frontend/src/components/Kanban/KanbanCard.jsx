import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, MessageCircle, Clock } from 'lucide-react';

export default function KanbanCard({ conversation, baseUrl, accountId }) {
  // Parsing details
  const timeAgo = formatDistanceToNow(new Date(conversation.timestamp * 1000), { addSuffix: true, locale: ptBR });
  const contact = conversation.meta?.sender;
  const agent = conversation.meta?.assignee;
  const unreadCount = conversation.unread_count || 0;

  const chatwootLink = `${baseUrl}/app/accounts/${accountId}/conversations/${conversation.id}`;

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(contact?.name || 'User')}&background=0D8ABC&color=fff`;
  
  return (
    <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg hover:shadow-xl hover:border-slate-500 transition-all group flex flex-col gap-3">
      
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <img src={contact?.thumbnail || defaultAvatar} alt="avatar" className="w-10 h-10 rounded-full border border-slate-600 object-cover" />
          <div>
            <h4 className="font-semibold text-slate-200 text-sm truncate w-32">{contact?.name || 'Desconhecido'}</h4>
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> {conversation.inbox_id ? `Inbox ${conversation.inbox_id}` : 'Sem Inbox'}
            </span>
          </div>
        </div>
        
        {unreadCount > 0 && (
          <span className="bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md shadow-blue-500/20">
            {unreadCount}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-1 text-xs text-slate-400">
        <div className="flex items-center gap-1.5" title="Responsável">
          {agent ? (
            <>
               <img src={agent.thumbnail || defaultAvatar} className="w-5 h-5 rounded-full" />
               <span className="truncate w-20">{agent.name}</span>
            </>
          ) : (
            <span className="italic">Não Atribuído</span>
          )}
        </div>
        
        <div className="flex items-center gap-1 text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
      </div>

      <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center opacity-70 group-hover:opacity-100 transition-opacity">
        <span className="text-[10px] uppercase font-bold text-slate-500">ID: #{conversation.id}</span>
        <a 
          href={chatwootLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-xs font-medium cursor-pointer"
        >
          Abrir 
          <ExternalLink className="w-3 h-3 inline" />
        </a>
      </div>

    </div>
  );
}

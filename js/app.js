/* ============================================
   DR. LUCAS CORDEIRO - FISIOTERAPEUTA
   Sistema de Gestão - JavaScript
   VERSÃO COM API REAL
   ============================================ */

// ============================================
// CONFIGURAÇÕES E ESTADO
// ============================================
const CONFIG = {
  // URL do Google Apps Script
  API_URL: localStorage.getItem('apiUrl') || '',
  
  COMISSAO_PILATES: 0.40,
  VALOR_AULA_AVULSA: 27.00,
  PLANOS_PILATES: { 1: 160.00, 2: 250.00, 3: 360.00 },
  HORARIOS: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
  DIAS_SEMANA: ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB']
};

const state = {
  paginaAtual: 'pageHoje',
  dataSelecionada: new Date(),
  clientes: [],
  agendaHoje: [],
  filtroClientes: 'todos',
  filtroFinanceiro: 'resumo'
};

// ============================================
// API - CONEXÃO COM GOOGLE SHEETS
// ============================================
async function apiCall(action, params = {}) {
  if (!CONFIG.API_URL) {
    console.warn('API não configurada');
    toast('Configure a API em Configurações', 'warning');
    return { success: false, error: 'API não configurada' };
  }
  
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({ action, params })
    });
    
    const result = await response.json();
    console.log(`API ${action}:`, result);
    return result;
  } catch (error) {
    console.error('Erro na API:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// INICIALIZAÇÃO
// ============================================
function inicializarApp() {
  // Carrega URL da API salva
  CONFIG.API_URL = localStorage.getItem('apiUrl') || '';
  
  atualizarDataHeader();
  carregarAgendaHoje();
  setInterval(atualizarDataHeader, 60000);
  
  if (!CONFIG.API_URL) {
    setTimeout(() => {
      toast('Configure a URL da API em Configurações', 'info');
    }, 2000);
  }
}

function atualizarDataHeader() {
  const hoje = new Date();
  const opcoes = { weekday: 'long', day: 'numeric', month: 'long' };
  document.getElementById('headerDate').textContent = capitalizar(hoje.toLocaleDateString('pt-BR', opcoes));
}

// ============================================
// NAVEGAÇÃO
// ============================================
function navegarPara(pageId) {
  state.paginaAtual = pageId;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-page="${pageId}"]`)?.classList.add('active');
  
  switch(pageId) {
    case 'pageHoje': carregarAgendaHoje(); break;
    case 'pageAgenda': carregarAgendaSemanal(); break;
    case 'pageClientes': carregarClientes(); break;
    case 'pageFinanceiro': carregarFinanceiro(); break;
  }
}

// ============================================
// AGENDA HOJE
// ============================================
async function carregarAgendaHoje() {
  const container = document.getElementById('hojeContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
  const result = await apiCall('getAgendaHoje');
  
  if (result.success && result.data) {
    state.agendaHoje = result.data;
    atualizarStatsHoje(result.data);
    renderizarAgendaHoje(result.data);
  } else {
    // Se não tem API ou deu erro, mostra vazio
    state.agendaHoje = [];
    atualizarStatsHoje([]);
    renderizarAgendaHoje([]);
  }
}

function atualizarStatsHoje(agendamentos) {
  const stats = {
    pilates: agendamentos.filter(a => a.Tipo === 'pilates').length,
    reab: agendamentos.filter(a => a.Tipo === 'reabilitacao').length,
    terapia: agendamentos.filter(a => a.Tipo === 'terapia').length
  };
  
  document.getElementById('hojeStats').innerHTML = `
    <span class="stat-badge pilates">${stats.pilates} Pilates</span>
    <span class="stat-badge reab">${stats.reab} Reab</span>
    <span class="stat-badge terapia">${stats.terapia} Terapia</span>
  `;
}

function renderizarAgendaHoje(agendamentos) {
  const container = document.getElementById('hojeContent');
  
  if (agendamentos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-round">event_available</span>
        <h3>Nenhum atendimento hoje</h3>
        <p>Clique no + para agendar</p>
      </div>
    `;
    return;
  }
  
  const porHorario = {};
  agendamentos.forEach(ag => {
    const hora = ag.Hora || '08:00';
    if (!porHorario[hora]) porHorario[hora] = [];
    porHorario[hora].push(ag);
  });
  
  const horariosComAgendamento = CONFIG.HORARIOS.filter(h => porHorario[h]?.length > 0);
  
  let html = '<div class="horarios-hoje">';
  
  horariosComAgendamento.forEach(hora => {
    const ags = porHorario[hora] || [];
    
    html += `
      <div class="horario-row">
        <div class="horario-time">${hora}</div>
        <div class="horario-content ${ags.length > 0 ? 'ocupado' : ''}">
    `;
    
    ags.forEach(ag => {
      const tipo = ag.Tipo || 'terapia';
      const statusClass = ag.Status === 'Realizado' ? 'realizado' : ag.Status === 'Faltou' ? 'faltou' : '';
      html += `
        <div class="atendimento-card ${tipo} ${statusClass}" onclick="abrirDetalheAtendimento('${ag.AgendamentoID}')">
          <div class="atendimento-nome">${ag.NomeCliente || 'Cliente'}</div>
          <div class="atendimento-info">
            <span>${tipo === 'pilates' ? '🧘' : tipo === 'reabilitacao' ? '🏥' : '💆'}</span>
            <span>${ag.Local === 'domicilio' ? '🏠 Domicílio' : '🏢 Clínica'}</span>
          </div>
          ${ag.Status !== 'Realizado' && ag.Status !== 'Faltou' && ag.Status !== 'FaltaJustificada' ? `
            <div class="atendimento-actions">
              <button class="atendimento-btn" onclick="event.stopPropagation(); marcarRealizado('${ag.AgendamentoID}')">✓ Realizado</button>
              <button class="atendimento-btn" onclick="event.stopPropagation(); abrirModalFalta('${ag.AgendamentoID}')">✗ Falta</button>
            </div>
          ` : ''}
        </div>
      `;
    });
    
    html += '</div></div>';
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// ============================================
// AGENDA SEMANAL
// ============================================
async function carregarAgendaSemanal() {
  const container = document.getElementById('agendaContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
  const inicioSemana = getInicioSemana(state.dataSelecionada);
  const fimSemana = new Date(inicioSemana);
  fimSemana.setDate(inicioSemana.getDate() + 5);
  
  document.getElementById('weekTitle').textContent = 
    `${inicioSemana.getDate()}/${inicioSemana.getMonth() + 1} - ${fimSemana.getDate()}/${fimSemana.getMonth() + 1}`;
  
  const result = await apiCall('getAgendaSemana', { inicioSemana: formatarData(inicioSemana) });
  const agendamentos = result.success ? (result.data || []) : [];
  
  renderizarAgendaSemanal(inicioSemana, agendamentos);
}

function renderizarAgendaSemanal(inicioSemana, agendamentos) {
  const container = document.getElementById('agendaContent');
  const hoje = new Date();
  
  let html = '<div class="agenda-grid">';
  html += '<div class="agenda-header"></div>';
  
  for (let i = 0; i < 6; i++) {
    const dia = new Date(inicioSemana);
    dia.setDate(inicioSemana.getDate() + i);
    const isHoje = isMesmaData(dia, hoje);
    
    html += `
      <div class="agenda-header ${isHoje ? 'hoje' : ''}">
        <div>${CONFIG.DIAS_SEMANA[dia.getDay()]}</div>
        <div class="dia-num">${dia.getDate()}</div>
      </div>
    `;
  }
  
  CONFIG.HORARIOS.forEach(hora => {
    html += `<div class="agenda-hora">${hora}</div>`;
    
    for (let i = 0; i < 6; i++) {
      const dia = new Date(inicioSemana);
      dia.setDate(inicioSemana.getDate() + i);
      const dataStr = formatarData(dia);
      const ags = agendamentos.filter(a => a.Data === dataStr && a.Hora === hora);
      
      html += `<div class="agenda-slot ${ags.length === 0 ? 'vazio' : ''}" onclick="abrirModalNovoAgendamento('${dataStr}', '${hora}')">`;
      
      ags.forEach(ag => {
        const tipo = ag.Tipo || 'terapia';
        html += `
          <div class="agenda-item ${tipo} ${ag.Status === 'Realizado' ? 'realizado' : ''}" 
               onclick="event.stopPropagation(); abrirDetalheAtendimento('${ag.AgendamentoID}')" title="${ag.NomeCliente}">
            ${(ag.NomeCliente || 'Cliente').split(' ')[0]}
          </div>
        `;
      });
      
      html += '</div>';
    }
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function semanaAnterior() {
  state.dataSelecionada.setDate(state.dataSelecionada.getDate() - 7);
  carregarAgendaSemanal();
}

function proximaSemana() {
  state.dataSelecionada.setDate(state.dataSelecionada.getDate() + 7);
  carregarAgendaSemanal();
}

// ============================================
// CLIENTES
// ============================================
async function carregarClientes() {
  const container = document.getElementById('clientesContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
  const result = await apiCall('getClientes');
  
  if (result.success && result.data) {
    state.clientes = result.data;
    renderizarClientes(result.data);
  } else {
    state.clientes = [];
    renderizarClientes([]);
  }
}

function renderizarClientes(clientes) {
  const container = document.getElementById('clientesContent');
  
  let clientesFiltrados = clientes;
  if (state.filtroClientes !== 'todos') {
    clientesFiltrados = clientes.filter(c => c.Tipo === state.filtroClientes);
  }
  
  const busca = document.getElementById('clienteSearch')?.value?.toLowerCase() || '';
  if (busca) {
    clientesFiltrados = clientesFiltrados.filter(c => 
      (c.Nome || '').toLowerCase().includes(busca) || (c.Telefone || '').includes(busca)
    );
  }
  
  if (clientesFiltrados.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-round">person_search</span>
        <h3>Nenhum cliente encontrado</h3>
        <p>Clique no + para cadastrar</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = clientesFiltrados.map(c => {
    const tipo = c.Tipo || 'terapia';
    return `
      <div class="card ${tipo}" onclick="abrirDetalheCliente('${c.ClienteID}')">
        <div class="card-header">
          <div class="card-title">${c.Nome || 'Cliente'}</div>
          <span class="card-badge ${tipo}">${formatarTipo(tipo)}</span>
        </div>
        <div class="card-info">
          <span class="card-info-item">
            <span class="material-icons-round">phone</span>
            ${c.Telefone || 'Sem telefone'}
          </span>
          ${tipo === 'pilates' ? `
            <span class="card-info-item">
              <span class="material-icons-round">event</span>
              ${c.FrequenciaSemanal || 2}x/semana
            </span>
            <span class="card-info-item status-badge status-${c.statusPagamento || 'pendente'}">
              ${c.statusPagamento === 'pago' ? '✓ Pago' : c.statusPagamento === 'atrasado' ? '! Atrasado' : '⏳ Pendente'}
            </span>
          ` : ''}
          ${c.Pausado ? '<span class="card-info-item status-badge status-pausado">⏸️ Pausado</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

function buscarClientes() {
  renderizarClientes(state.clientes);
}

function filtrarClientes(filtro) {
  state.filtroClientes = filtro;
  document.querySelectorAll('#pageClientes .filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filtro);
  });
  renderizarClientes(state.clientes);
}

// ============================================
// FINANCEIRO
// ============================================
async function carregarFinanceiro() {
  const container = document.getElementById('financeiroContent');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  
  switch(state.filtroFinanceiro) {
    case 'resumo': await renderizarResumoFinanceiro(container); break;
    case 'mensalidades': await renderizarMensalidades(container); break;
    case 'pacotes': await renderizarPacotes(container); break;
    case 'comissoes': await renderizarComissoes(container); break;
  }
}

function filtrarFinanceiro(filtro) {
  state.filtroFinanceiro = filtro;
  document.querySelectorAll('#pageFinanceiro .filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filtro);
  });
  carregarFinanceiro();
}

async function renderizarResumoFinanceiro(container) {
  const result = await apiCall('getResumoFinanceiro', { 
    mes: new Date().getMonth() + 1, 
    ano: new Date().getFullYear() 
  });
  
  const dados = result.success && result.data ? result.data : {
    totalMes: 0, recebido: 0, pendente: 0, comissoes: 0, atendimentos: 0
  };
  
  container.innerHTML = `
    <div class="finance-summary">
      <div class="finance-card highlight">
        <div class="finance-value">${formatarMoeda(dados.totalMes)}</div>
        <div class="finance-label">Total do Mês</div>
      </div>
      <div class="finance-card">
        <div class="finance-value" style="color: var(--success)">${formatarMoeda(dados.recebido)}</div>
        <div class="finance-label">Recebido</div>
      </div>
      <div class="finance-card">
        <div class="finance-value" style="color: var(--warning)">${formatarMoeda(dados.pendente)}</div>
        <div class="finance-label">Pendente</div>
      </div>
      <div class="finance-card">
        <div class="finance-value" style="color: var(--pilates)">${formatarMoeda(dados.comissoes)}</div>
        <div class="finance-label">Comissões Pilates</div>
      </div>
      <div class="finance-card">
        <div class="finance-value">${dados.atendimentos}</div>
        <div class="finance-label">Atendimentos</div>
      </div>
    </div>
  `;
}

async function renderizarMensalidades(container) {
  const result = await apiCall('getMensalidades', { 
    mes: new Date().getMonth() + 1, 
    ano: new Date().getFullYear() 
  });
  
  const mensalidades = result.success && result.data ? result.data : [];
  
  if (mensalidades.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="material-icons-round">payments</span><h3>Nenhuma mensalidade</h3></div>`;
    return;
  }
  
  container.innerHTML = mensalidades.map(m => `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${m.NomeCliente}</div>
        <span class="status-badge status-${m.Status === 'Pago' ? 'pago' : m.Status === 'Atrasado' ? 'atrasado' : 'pendente'}">
          ${m.Status}
        </span>
      </div>
      <div class="card-info">
        <span>Vencimento: ${new Date(m.Vencimento).toLocaleDateString('pt-BR')}</span>
        <span style="font-weight: 600; color: var(--primary);">${formatarMoeda(m.Valor)}</span>
      </div>
      ${m.Status !== 'Pago' ? `
        <button class="btn btn-sm btn-primary" style="margin-top: 8px;" onclick="registrarPagamento('${m.MensalidadeID}')">
          Registrar Pagamento
        </button>
      ` : ''}
    </div>
  `).join('');
}

async function renderizarPacotes(container) {
  const result = await apiCall('getPacotes', { status: 'Ativo' });
  const pacotes = result.success && result.data ? result.data : [];
  
  if (pacotes.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="material-icons-round">inventory_2</span><h3>Nenhum pacote ativo</h3></div>`;
    return;
  }
  
  container.innerHTML = pacotes.map(p => {
    const percentual = (p.SessoesRestantes / p.TotalSessoes) * 100;
    return `
      <div class="card reabilitacao">
        <div class="card-header">
          <div class="card-title">${p.NomeCliente}</div>
          <span>${p.SessoesRestantes}/${p.TotalSessoes}</span>
        </div>
        <div style="background: var(--cream); border-radius: 4px; height: 8px; overflow: hidden; margin: 8px 0;">
          <div style="background: var(--reabilitacao); height: 100%; width: ${percentual}%;"></div>
        </div>
        <div class="card-info">
          <span>Validade: ${new Date(p.Validade).toLocaleDateString('pt-BR')}</span>
          <span>${formatarMoeda(p.ValorTotal)}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function renderizarComissoes(container) {
  const result = await apiCall('getComissoes', { 
    mes: new Date().getMonth() + 1, 
    ano: new Date().getFullYear() 
  });
  
  const dados = result.success && result.data ? result.data : {
    totalComissoes: 0,
    mensalidades: { total: 0, quantidade: 0 },
    aulasAvulsas: { total: 0, quantidade: 0 }
  };
  
  container.innerHTML = `
    <div class="finance-summary">
      <div class="finance-card highlight" style="background: linear-gradient(145deg, var(--pilates) 0%, #5a4a8a 100%);">
        <div class="finance-value">${formatarMoeda(dados.totalComissoes)}</div>
        <div class="finance-label">Comissões do Mês</div>
      </div>
      <div class="finance-card">
        <div class="finance-value">${formatarMoeda(dados.mensalidades?.total || 0)}</div>
        <div class="finance-label">Mensalidades (40%)</div>
      </div>
      <div class="finance-card">
        <div class="finance-value">${formatarMoeda(dados.aulasAvulsas?.total || 0)}</div>
        <div class="finance-label">Aulas Avulsas</div>
      </div>
    </div>
  `;
}

// ============================================
// MODAIS
// ============================================
function abrirModal(titulo, conteudo) {
  document.getElementById('modalTitle').textContent = titulo;
  document.getElementById('modalBody').innerHTML = conteudo;
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function fecharModal(event) {
  if (event && event.target !== event.currentTarget) return;
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function abrirNovoModal() {
  abrirModal('Novo', `
    <div class="menu-list">
      <button class="menu-item" onclick="fecharModal(); abrirModalNovoCliente('pilates')">
        <span class="material-icons-round" style="color: var(--pilates);">self_improvement</span>
        <span>Novo Aluno Pilates</span>
      </button>
      <button class="menu-item" onclick="fecharModal(); abrirModalNovoCliente('reabilitacao')">
        <span class="material-icons-round" style="color: var(--reabilitacao);">medical_services</span>
        <span>Novo Paciente Reabilitação</span>
      </button>
      <button class="menu-item" onclick="fecharModal(); abrirModalNovoCliente('terapia')">
        <span class="material-icons-round" style="color: var(--terapia);">spa</span>
        <span>Novo Paciente Terapia Manual</span>
      </button>
      <button class="menu-item" onclick="fecharModal(); abrirModalAulaAvulsa()">
        <span class="material-icons-round" style="color: var(--accent);">event_available</span>
        <span>Registrar Aula Avulsa</span>
      </button>
      <button class="menu-item" onclick="fecharModal(); abrirModalAgendamentoRapido()">
        <span class="material-icons-round" style="color: var(--primary);">add_circle</span>
        <span>Agendamento Rápido</span>
      </button>
    </div>
  `);
}

function abrirModalNovoCliente(tipo) {
  let camposEspecificos = '';
  
  if (tipo === 'pilates') {
    camposEspecificos = `
      <div class="form-group">
        <label class="form-label">Frequência Semanal</label>
        <div class="radio-group">
          <label class="radio-option"><input type="radio" name="frequencia" value="1"><span class="radio-label">1x/sem - ${formatarMoeda(CONFIG.PLANOS_PILATES[1])}</span></label>
          <label class="radio-option"><input type="radio" name="frequencia" value="2" checked><span class="radio-label">2x/sem - ${formatarMoeda(CONFIG.PLANOS_PILATES[2])}</span></label>
          <label class="radio-option"><input type="radio" name="frequencia" value="3"><span class="radio-label">3x/sem - ${formatarMoeda(CONFIG.PLANOS_PILATES[3])}</span></label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Dia do Vencimento</label>
        <input type="number" class="form-input" name="diaVencimento" min="1" max="31" placeholder="Ex: 10" value="10">
      </div>
      <div class="form-group">
        <label class="form-label">Horários Fixos</label>
        <div class="form-hint">Selecione os dias e horários das aulas</div>
        <div id="horariosContainer" style="margin-top: 8px;">${renderizarSeletorHorarios()}</div>
      </div>
    `;
  } else if (tipo === 'reabilitacao') {
    camposEspecificos = `
      <div class="form-group">
        <label class="form-label">Tipo de Atendimento</label>
        <div class="radio-group">
          <label class="radio-option"><input type="radio" name="local" value="clinica" checked><span class="radio-label">🏢 Clínica</span></label>
          <label class="radio-option"><input type="radio" name="local" value="domicilio"><span class="radio-label">🏠 Domicílio</span></label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Pacote</label>
        <div class="form-row">
          <div><label class="form-label" style="font-size: 0.7rem;">Nº de Sessões</label><input type="number" class="form-input" name="totalSessoes" placeholder="Ex: 10" value="10"></div>
          <div><label class="form-label" style="font-size: 0.7rem;">Valor Total</label><input type="number" class="form-input" name="valorPacote" placeholder="Ex: 800" step="0.01"></div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Validade do Pacote</label>
        <input type="date" class="form-input" name="validadePacote">
        <div class="form-hint">+1 semana de margem para reposições</div>
      </div>
      <div class="form-group">
        <label class="form-label">Horários Fixos</label>
        <div id="horariosContainer" style="margin-top: 8px;">${renderizarSeletorHorarios()}</div>
      </div>
    `;
  } else {
    camposEspecificos = `
      <div class="form-group">
        <label class="form-label">Tipo de Atendimento</label>
        <div class="radio-group">
          <label class="radio-option"><input type="radio" name="local" value="clinica" checked><span class="radio-label">🏢 Clínica</span></label>
          <label class="radio-option"><input type="radio" name="local" value="domicilio"><span class="radio-label">🏠 Domicílio</span></label>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Valor por Sessão</label>
        <input type="number" class="form-input" name="valorSessao" placeholder="Ex: 120" step="0.01">
      </div>
    `;
  }
  
  const conteudo = `
    <form id="formNovoCliente" onsubmit="salvarCliente(event, '${tipo}')">
      <input type="hidden" name="tipo" value="${tipo}">
      <div class="form-group">
        <label class="form-label">Nome Completo *</label>
        <input type="text" class="form-input" name="nome" required placeholder="Nome do ${tipo === 'pilates' ? 'aluno' : 'paciente'}">
      </div>
      <div class="form-group">
        <label class="form-label">Telefone</label>
        <input type="tel" class="form-input" name="telefone" placeholder="(00) 00000-0000">
      </div>
      ${tipo !== 'pilates' ? `<div class="form-group"><label class="form-label">Endereço (para domicílio)</label><input type="text" class="form-input" name="endereco" placeholder="Rua, número, bairro"></div>` : ''}
      ${camposEspecificos}
      <div class="form-group">
        <label class="form-label">Observações</label>
        <textarea class="form-textarea" name="observacoes" placeholder="Informações importantes..."></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> Salvar</button>
      </div>
    </form>
  `;
  
  const titulos = { pilates: '🧘 Novo Aluno Pilates', reabilitacao: '🏥 Novo Paciente Reabilitação', terapia: '💆 Novo Paciente Terapia Manual' };
  abrirModal(titulos[tipo], conteudo);
}

function renderizarSeletorHorarios() {
  const dias = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
  return dias.map(dia => `
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
      <label class="checkbox-option" style="min-width: 70px;">
        <input type="checkbox" name="dia_${dia}" onchange="toggleHorarioDia('${dia}', this.checked)">
        <span class="checkbox-label">${dia}</span>
      </label>
      <input type="time" class="form-input" id="hora_${dia}" name="hora_${dia}" style="flex: 1; padding: 8px; opacity: 0.5;" disabled value="08:00">
    </div>
  `).join('');
}

function toggleHorarioDia(dia, checked) {
  const input = document.getElementById('hora_' + dia);
  if (input) { input.disabled = !checked; input.style.opacity = checked ? '1' : '0.5'; }
}

async function salvarCliente(event, tipo) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  // Monta horários
  const horarios = {};
  ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].forEach(dia => {
    if (formData.get('dia_' + dia)) {
      horarios[dia] = formData.get('hora_' + dia) || '08:00';
    }
  });
  
  const dados = {
    Nome: formData.get('nome'),
    Telefone: formData.get('telefone'),
    Endereco: formData.get('endereco'),
    Tipo: tipo,
    Local: formData.get('local') || 'clinica',
    FrequenciaSemanal: formData.get('frequencia') || 2,
    DiaVencimento: formData.get('diaVencimento') || 10,
    ValorSessao: formData.get('valorSessao'),
    TotalSessoes: formData.get('totalSessoes'),
    ValorPacote: formData.get('valorPacote'),
    ValidadePacote: formData.get('validadePacote'),
    Observacoes: formData.get('observacoes'),
    horarios: horarios
  };
  
  const result = await apiCall('createCliente', dados);
  
  if (result.success) {
    toast('Cliente cadastrado com sucesso!', 'success');
    fecharModal();
    carregarClientes();
    carregarAgendaHoje();
  } else {
    toast('Erro ao cadastrar: ' + (result.error || 'Tente novamente'), 'error');
  }
}

// ============================================
// AÇÕES
// ============================================
async function marcarRealizado(agendamentoId) {
  const result = await apiCall('marcarRealizado', { id: agendamentoId });
  
  if (result.success) {
    toast('Atendimento realizado!', 'success');
    carregarAgendaHoje();
  } else {
    toast('Erro: ' + (result.error || 'Tente novamente'), 'error');
  }
}

function abrirModalFalta(agendamentoId) {
  abrirModal('Registrar Falta', `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="material-icons-round" style="font-size: 3rem; color: var(--warning);">warning</span>
    </div>
    <div class="form-group">
      <label class="form-label">Tipo de Falta</label>
      <div class="radio-group" style="flex-direction: column; gap: 12px;">
        <label class="radio-option">
          <input type="radio" name="tipoFalta" value="justificada">
          <span class="radio-label" style="flex-direction: column; align-items: flex-start;">
            <strong>✓ Justificada</strong>
            <small style="font-weight: normal; color: var(--text-muted);">Avisou com antecedência - Tem direito a reposição</small>
          </span>
        </label>
        <label class="radio-option">
          <input type="radio" name="tipoFalta" value="naoJustificada" checked>
          <span class="radio-label" style="flex-direction: column; align-items: flex-start;">
            <strong>✗ Não Justificada</strong>
            <small style="font-weight: normal; color: var(--text-muted);">Não avisou - Aula conta como dada</small>
          </span>
        </label>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
      <button class="btn btn-accent" onclick="confirmarFalta('${agendamentoId}')">Confirmar</button>
    </div>
  `);
}

async function confirmarFalta(agendamentoId) {
  const tipoFalta = document.querySelector('input[name="tipoFalta"]:checked')?.value || 'naoJustificada';
  
  const result = await apiCall('marcarFalta', { id: agendamentoId, tipoFalta });
  
  if (result.success) {
    toast(result.message || 'Falta registrada', tipoFalta === 'justificada' ? 'warning' : 'info');
    fecharModal();
    carregarAgendaHoje();
  } else {
    toast('Erro: ' + (result.error || 'Tente novamente'), 'error');
  }
}

async function abrirDetalheCliente(clienteId) {
  const result = await apiCall('getCliente', { id: clienteId });
  
  if (!result.success || !result.data) {
    toast('Cliente não encontrado', 'error');
    return;
  }
  
  const c = result.data;
  const tipo = c.Tipo || 'terapia';
  
  let infoEspecifica = '';
  
  if (tipo === 'pilates') {
    infoEspecifica = `
      <div class="finance-summary" style="margin-bottom: 16px;">
        <div class="finance-card"><div class="finance-value">${c.FrequenciaSemanal || 2}x</div><div class="finance-label">Por Semana</div></div>
        <div class="finance-card"><div class="finance-value">${formatarMoeda(CONFIG.PLANOS_PILATES[c.FrequenciaSemanal] || 280)}</div><div class="finance-label">Mensalidade</div></div>
      </div>
      <div class="card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">Vencimento</span><strong>Dia ${c.DiaVencimento || 10}</strong></div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px;"><span style="color: var(--text-muted);">Sua Comissão</span><strong style="color: var(--pilates);">${formatarMoeda((CONFIG.PLANOS_PILATES[c.FrequenciaSemanal] || 280) * CONFIG.COMISSAO_PILATES)}</strong></div>
      </div>
    `;
  } else if (tipo === 'reabilitacao' && c.pacote) {
    const percentual = (c.pacote.SessoesRestantes / c.pacote.TotalSessoes) * 100;
    infoEspecifica = `
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-title" style="margin-bottom: 12px;">📦 Pacote</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: var(--text-muted);">Sessões</span><strong>${c.pacote.SessoesRestantes}/${c.pacote.TotalSessoes} restantes</strong></div>
        <div style="background: var(--cream); border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 8px;"><div style="background: var(--reabilitacao); height: 100%; width: ${percentual}%;"></div></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">Valor Total</span><strong>${formatarMoeda(c.pacote.ValorTotal)}</strong></div>
      </div>
    `;
  }
  
  abrirModal(c.Nome, `
    <div style="text-align: center; padding: 16px; background: var(--cream-light); border-radius: var(--radius); margin-bottom: 16px;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--${tipo}); color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 1.5rem; font-family: 'Cormorant Garamond', serif;">${(c.Nome || 'C').charAt(0)}</div>
      <div style="font-size: 1.4rem; font-weight: 600; color: var(--text-dark); font-family: 'Cormorant Garamond', serif;">${c.Nome}</div>
      <span class="card-badge ${tipo}" style="margin-top: 8px; display: inline-block;">${formatarTipo(tipo)}</span>
      ${c.Pausado ? '<div class="status-badge status-pausado" style="margin-top: 8px;">⏸️ Pausado</div>' : ''}
    </div>
    <div class="card" style="margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"><span class="material-icons-round" style="color: var(--text-muted);">phone</span><span>${c.Telefone || 'Sem telefone'}</span></div>
      ${c.Endereco ? `<div style="display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="color: var(--text-muted);">location_on</span><span>${c.Endereco}</span></div>` : ''}
    </div>
    ${infoEspecifica}
    ${c.AgendaFixa ? `<div class="card" style="margin-bottom: 16px;"><div class="card-title" style="margin-bottom: 8px;">📅 Horários Fixos</div><div style="color: var(--text-medium);">${c.AgendaFixa}</div></div>` : ''}
    <div class="form-actions" style="margin-bottom: 12px;">
      <button class="btn btn-primary" onclick="abrirWhatsApp('${c.Telefone}')"><span class="material-icons-round">send</span> WhatsApp</button>
      <button class="btn btn-secondary" onclick="toast('Em desenvolvimento', 'info')"><span class="material-icons-round">edit</span> Editar</button>
    </div>
    <button class="btn ${c.Pausado ? 'btn-primary' : 'btn-accent'} btn-block" onclick="togglePausaCliente('${c.ClienteID}', ${!!c.Pausado})">
      <span class="material-icons-round">${c.Pausado ? 'play_arrow' : 'pause'}</span> ${c.Pausado ? 'Reativar' : 'Pausar'} Cliente
    </button>
  `);
}

async function togglePausaCliente(clienteId, pausadoAtualmente) {
  const result = await apiCall('togglePausaCliente', { id: clienteId });
  
  if (result.success) {
    toast(result.data?.message || 'Status alterado!', 'success');
    fecharModal();
    carregarClientes();
  } else {
    toast('Erro: ' + (result.error || 'Tente novamente'), 'error');
  }
}

function abrirDetalheAtendimento(agendamentoId) {
  const ag = state.agendaHoje.find(a => a.AgendamentoID === agendamentoId);
  if (!ag) {
    toast('Atendimento não encontrado', 'error');
    return;
  }
  
  const tipo = ag.Tipo || 'terapia';
  
  abrirModal('Detalhes', `
    <div style="text-align: center; padding: 16px; background: var(--cream-light); border-radius: var(--radius); margin-bottom: 16px;">
      <div style="font-size: 1.4rem; font-weight: 600; color: var(--text-dark); font-family: 'Cormorant Garamond', serif;">${ag.NomeCliente || 'Cliente'}</div>
      <div style="color: var(--text-muted); margin-top: 4px;">${ag.Hora} • ${formatarTipo(tipo)}</div>
      <span class="card-badge ${tipo}" style="margin-top: 8px; display: inline-block;">${ag.Local === 'domicilio' ? '🏠 Domicílio' : '🏢 Clínica'}</span>
    </div>
    ${ag.Status !== 'Realizado' && ag.Status !== 'Faltou' && ag.Status !== 'FaltaJustificada' ? `
      <div class="form-actions" style="margin-bottom: 16px;">
        <button class="btn btn-primary" onclick="marcarRealizado('${ag.AgendamentoID}'); fecharModal();"><span class="material-icons-round">check_circle</span> Realizado</button>
        <button class="btn btn-accent" onclick="fecharModal(); abrirModalFalta('${ag.AgendamentoID}')"><span class="material-icons-round">cancel</span> Falta</button>
      </div>
    ` : `
      <div style="text-align: center; padding: 12px; background: ${ag.Status === 'Realizado' ? 'var(--primary-ultra-light)' : 'rgba(199, 107, 107, 0.1)'}; border-radius: var(--radius); margin-bottom: 16px;">
        <span style="color: ${ag.Status === 'Realizado' ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${ag.Status === 'Realizado' ? '✓ Atendimento Realizado' : '✗ Falta Registrada'}</span>
      </div>
    `}
    <button class="btn btn-outline btn-block" onclick="fecharModal(); abrirDetalheCliente('${ag.ClienteID}')">
      <span class="material-icons-round">person</span> Ver Perfil do Cliente
    </button>
  `);
}

function abrirModalAulaAvulsa() {
  abrirModal('📝 Aula Avulsa', `
    <form onsubmit="salvarAulaAvulsa(event)">
      <p style="color: var(--text-muted); margin-bottom: 16px;">Registre aulas dadas para alunos de outra fisioterapeuta.</p>
      <div class="form-group">
        <label class="form-label">Nome do Aluno</label>
        <input type="text" class="form-input" name="nomeAluno" required placeholder="Nome do aluno">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" class="form-input" name="data" required value="${formatarData(new Date())}">
        </div>
        <div class="form-group">
          <label class="form-label">Hora</label>
          <input type="time" class="form-input" name="hora" required value="08:00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Valor da Aula</label>
        <input type="number" class="form-input" name="valor" value="27" step="0.01" required>
        <div class="form-hint">Sua comissão (40%): ${formatarMoeda(CONFIG.VALOR_AULA_AVULSA * CONFIG.COMISSAO_PILATES)}</div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Registrar</button>
      </div>
    </form>
  `);
}

async function salvarAulaAvulsa(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  const result = await apiCall('createAulaAvulsa', {
    NomeAluno: formData.get('nomeAluno'),
    Data: formData.get('data'),
    Hora: formData.get('hora'),
    Valor: parseFloat(formData.get('valor')) || 27
  });
  
  if (result.success) {
    toast(`Aula avulsa registrada! Comissão: ${formatarMoeda(result.data?.Comissao || 10.80)}`, 'success');
    fecharModal();
  } else {
    toast('Erro: ' + (result.error || 'Tente novamente'), 'error');
  }
}

function abrirModalNovoAgendamento(data, hora) {
  if (state.clientes.length === 0) {
    toast('Cadastre um cliente primeiro', 'warning');
    return;
  }
  
  abrirModal('📅 Novo Agendamento', `
    <form onsubmit="salvarAgendamento(event)">
      <input type="hidden" name="data" value="${data}">
      <input type="hidden" name="hora" value="${hora}">
      <div style="text-align: center; padding: 12px; background: var(--cream-light); border-radius: var(--radius); margin-bottom: 16px;">
        <strong>${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
        <br>às <strong>${hora}</strong>
      </div>
      <div class="form-group">
        <label class="form-label">Cliente</label>
        <select class="form-select" name="clienteId" required onchange="preencherDadosCliente(this.value)">
          <option value="">Selecione...</option>
          ${state.clientes.map(c => `<option value="${c.ClienteID}" data-tipo="${c.Tipo}" data-nome="${c.Nome}">${c.Nome} (${formatarTipo(c.Tipo)})</option>`).join('')}
        </select>
      </div>
      <input type="hidden" name="tipo" id="tipoAgendamento" value="terapia">
      <input type="hidden" name="nomeCliente" id="nomeClienteAgendamento" value="">
      <div class="form-group">
        <label class="form-label">Observações</label>
        <textarea class="form-textarea" name="observacoes" placeholder="Informações adicionais..."></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Agendar</button>
      </div>
    </form>
  `);
}

function preencherDadosCliente(clienteId) {
  const cliente = state.clientes.find(c => c.ClienteID === clienteId);
  if (cliente) {
    document.getElementById('tipoAgendamento').value = cliente.Tipo || 'terapia';
    document.getElementById('nomeClienteAgendamento').value = cliente.Nome || '';
  }
}

async function salvarAgendamento(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  const result = await apiCall('createAgendamento', {
    Data: formData.get('data'),
    Hora: formData.get('hora'),
    ClienteID: formData.get('clienteId'),
    NomeCliente: formData.get('nomeCliente'),
    Tipo: formData.get('tipo'),
    Observacoes: formData.get('observacoes')
  });
  
  if (result.success) {
    toast('Agendamento criado!', 'success');
    fecharModal();
    carregarAgendaSemanal();
    carregarAgendaHoje();
  } else {
    toast('Erro: ' + (result.error || 'Tente novamente'), 'error');
  }
}

function abrirModalAgendamentoRapido() {
  abrirModal('⚡ Agendamento Rápido', `
    <form onsubmit="salvarAgendamentoRapido(event)">
      <div class="form-group">
        <label class="form-label">Nome do Cliente</label>
        <input type="text" class="form-input" name="nomeCliente" required placeholder="Nome">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Data</label>
          <input type="date" class="form-input" name="data" required value="${formatarData(new Date())}">
        </div>
        <div class="form-group">
          <label class="form-label">Hora</label>
          <input type="time" class="form-input" name="hora" required value="08:00">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tipo</label>
        <div class="radio-group">
          <label class="radio-option"><input type="radio" name="tipo" value="pilates"><span class="radio-label">Pilates</span></label>
          <label class="radio-option"><input type="radio" name="tipo" value="reabilitacao"><span class="radio-label">Reab</span></label>
          <label class="radio-option"><input type="radio" name="tipo" value="terapia" checked><span class="radio-label">Terapia</span></label>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Agendar</button>
      </div>
    </form>
  `);
}

async function salvarAgendamentoRapido(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  
  const result = await apiCall('createAgendamento', {
    Data: formData.get('data'),
    Hora: formData.get('hora'),
    NomeCliente: formData.get('nomeCliente'),
    Tipo: formData.get('tipo'),
    TipoAgendamento: 'avulso'
  });
  
  if (result.success) {
    toast('Agendamento criado!', 'success');
    fecharModal();
    carregarAgendaSemanal();
    carregarAgendaHoje();
  } else {
    toast('Erro: ' + (result.error || 'Tente novamente'), 'error');
  }
}

// ============================================
// CONFIGURAÇÕES
// ============================================
function abrirConfiguracoes() {
  abrirModal('⚙️ Configurações', `
    <div class="menu-list">
      <button class="menu-item" onclick="abrirConfigAPI()">
        <span class="material-icons-round">link</span>
        <span>Configurar API</span>
        <span class="material-icons-round arrow">chevron_right</span>
      </button>
      <button class="menu-item" onclick="abrirRelatorios()">
        <span class="material-icons-round">assessment</span>
        <span>Relatórios</span>
        <span class="material-icons-round arrow">chevron_right</span>
      </button>
      <button class="menu-item" onclick="abrirReposicoes()">
        <span class="material-icons-round">event_repeat</span>
        <span>Reposições Pendentes</span>
        <span class="material-icons-round arrow">chevron_right</span>
      </button>
      <button class="menu-item" onclick="abrirAulasAvulsas()">
        <span class="material-icons-round">event_available</span>
        <span>Aulas Avulsas</span>
        <span class="material-icons-round arrow">chevron_right</span>
      </button>
    </div>
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--cream); text-align: center;">
      <p style="font-size: 0.8rem; color: var(--text-muted);">Dr. Lucas Cordeiro - Fisioterapeuta<br>Versão 1.0.0</p>
    </div>
  `);
}

function abrirConfigAPI() {
  abrirModal('🔗 Configurar API', `
    <form onsubmit="salvarConfigAPI(event)">
      <div class="form-group">
        <label class="form-label">URL do Google Apps Script</label>
        <input type="url" class="form-input" name="apiUrl" value="${CONFIG.API_URL}" 
               placeholder="https://script.google.com/macros/s/.../exec" required>
        <div class="form-hint">Cole a URL da implantação do Apps Script</div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Salvar</button>
      </div>
    </form>
  `);
}

function salvarConfigAPI(event) {
  event.preventDefault();
  const url = event.target.apiUrl.value;
  localStorage.setItem('apiUrl', url);
  CONFIG.API_URL = url;
  toast('API configurada! Recarregando...', 'success');
  fecharModal();
  setTimeout(() => location.reload(), 1000);
}

function abrirRelatorios() {
  toast('Em desenvolvimento', 'info');
}

async function abrirReposicoes() {
  const result = await apiCall('getReposicoes', { status: 'Pendente' });
  const reposicoes = result.success && result.data ? result.data : [];
  
  if (reposicoes.length === 0) {
    abrirModal('🔄 Reposições', `<div class="empty-state"><span class="material-icons-round">event_repeat</span><h3>Nenhuma reposição pendente</h3></div>`);
    return;
  }
  
  abrirModal('🔄 Reposições Pendentes', reposicoes.map(r => `
    <div class="card pilates">
      <div class="card-header">
        <div class="card-title">${r.NomeCliente}</div>
        <span class="status-badge status-pendente">Pendente</span>
      </div>
      <div class="card-info">Falta em ${new Date(r.DataFalta).toLocaleDateString('pt-BR')}</div>
    </div>
  `).join(''));
}

async function abrirAulasAvulsas() {
  const result = await apiCall('getAulasAvulsas', { 
    mes: new Date().getMonth() + 1, 
    ano: new Date().getFullYear() 
  });
  const aulas = result.success && result.data ? result.data : [];
  
  const totalComissao = aulas.reduce((acc, a) => acc + (parseFloat(a.Comissao) || 0), 0);
  
  abrirModal('📝 Aulas Avulsas', `
    <div class="finance-card" style="margin-bottom: 16px; text-align: center;">
      <div class="finance-value" style="color: var(--pilates);">${formatarMoeda(totalComissao)}</div>
      <div class="finance-label">Comissão do Mês (${aulas.length} aulas)</div>
    </div>
    <button class="btn btn-primary btn-block" style="margin-bottom: 16px;" onclick="fecharModal(); abrirModalAulaAvulsa()">
      <span class="material-icons-round">add</span> Nova Aula Avulsa
    </button>
    ${aulas.length > 0 ? aulas.slice(0, 10).map(a => `
      <div class="card">
        <div class="card-header">
          <div class="card-title">${a.NomeAluno}</div>
          <span style="color: var(--pilates); font-weight: 600;">${formatarMoeda(a.Comissao)}</span>
        </div>
        <div class="card-info">${new Date(a.Data).toLocaleDateString('pt-BR')} • ${a.Hora}</div>
      </div>
    `).join('') : ''}
  `);
}

function abrirWhatsApp(telefone) {
  if (!telefone) {
    toast('Cliente sem telefone cadastrado', 'warning');
    return;
  }
  const telLimpo = telefone.replace(/\D/g, '');
  const telFormatado = telLimpo.startsWith('55') ? telLimpo : '55' + telLimpo;
  window.open(`https://wa.me/${telFormatado}`, '_blank');
}

// ============================================
// UTILITÁRIOS
// ============================================
function toast(msg, tipo = 'info') {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function formatarMoeda(valor) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0);
}

function formatarData(data) {
  const d = new Date(data);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatarTipo(tipo) {
  return { pilates: 'Pilates', reabilitacao: 'Reabilitação', terapia: 'Terapia Manual' }[tipo] || tipo;
}

function capitalizar(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getInicioSemana(data) {
  const d = new Date(data);
  const dia = d.getDay();
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isMesmaData(a, b) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

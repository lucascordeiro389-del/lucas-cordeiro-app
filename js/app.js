/* ============================================
   DR. LUCAS CORDEIRO - FISIOTERAPEUTA
   Sistema de Gestão - JavaScript
   ============================================ */

// ============================================
// CONFIGURAÇÕES E ESTADO
// ============================================
const CONFIG = {
  API_URL: '',
  COMISSAO_PILATES: 0.40,
  VALOR_AULA_AVULSA: 27.00,
  PLANOS_PILATES: { 1: 180.00, 2: 280.00, 3: 380.00 },
  HORARIOS: ['07:00', '08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
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
// INICIALIZAÇÃO
// ============================================
function inicializarApp() {
  atualizarDataHeader();
  carregarAgendaHoje();
  setInterval(atualizarDataHeader, 60000);
  CONFIG.API_URL = localStorage.getItem('apiUrl') || '';
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
  
  const agendamentos = gerarDadosExemplo();
  state.agendaHoje = agendamentos;
  atualizarStatsHoje(agendamentos);
  renderizarAgendaHoje(agendamentos);
}

function atualizarStatsHoje(agendamentos) {
  const stats = {
    pilates: agendamentos.filter(a => a.tipo === 'pilates').length,
    reab: agendamentos.filter(a => a.tipo === 'reabilitacao').length,
    terapia: agendamentos.filter(a => a.tipo === 'terapia').length
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
        <p>Aproveite o dia livre!</p>
      </div>
    `;
    return;
  }
  
  const porHorario = {};
  agendamentos.forEach(ag => {
    const hora = ag.hora || '08:00';
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
      const statusClass = ag.status === 'realizado' ? 'realizado' : ag.status === 'faltou' ? 'faltou' : '';
      html += `
        <div class="atendimento-card ${ag.tipo} ${statusClass}" onclick="abrirDetalheAtendimento('${ag.id}')">
          <div class="atendimento-nome">${ag.nome}</div>
          <div class="atendimento-info">
            <span>${ag.tipo === 'pilates' ? '🧘' : ag.tipo === 'reabilitacao' ? '🏥' : '💆'}</span>
            <span>${ag.local === 'domicilio' ? '🏠 Domicílio' : '🏢 Clínica'}</span>
            ${ag.tipo === 'pilates' ? `<span>👥 ${ag.totalAlunos || 1}/4</span>` : ''}
          </div>
          ${ag.status !== 'realizado' && ag.status !== 'faltou' ? `
            <div class="atendimento-actions">
              <button class="atendimento-btn" onclick="event.stopPropagation(); marcarRealizado('${ag.id}')">✓ Realizado</button>
              <button class="atendimento-btn" onclick="event.stopPropagation(); abrirModalFalta('${ag.id}')">✗ Falta</button>
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
  
  const agendamentos = gerarDadosExemploSemana(inicioSemana);
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
      const ags = agendamentos.filter(a => a.data === dataStr && a.hora === hora);
      
      html += `<div class="agenda-slot ${ags.length === 0 ? 'vazio' : ''}" onclick="abrirModalNovoAgendamento('${dataStr}', '${hora}')">`;
      
      ags.forEach(ag => {
        html += `
          <div class="agenda-item ${ag.tipo} ${ag.status === 'realizado' ? 'realizado' : ''}" 
               onclick="event.stopPropagation(); abrirDetalheAtendimento('${ag.id}')" title="${ag.nome}">
            ${ag.nome.split(' ')[0]}
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
  
  const clientes = gerarClientesExemplo();
  state.clientes = clientes;
  renderizarClientes(clientes);
}

function renderizarClientes(clientes) {
  const container = document.getElementById('clientesContent');
  
  let clientesFiltrados = clientes;
  if (state.filtroClientes !== 'todos') {
    clientesFiltrados = clientes.filter(c => c.tipo === state.filtroClientes);
  }
  
  const busca = document.getElementById('clienteSearch')?.value?.toLowerCase() || '';
  if (busca) {
    clientesFiltrados = clientesFiltrados.filter(c => 
      c.nome.toLowerCase().includes(busca) || c.telefone?.includes(busca)
    );
  }
  
  if (clientesFiltrados.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-icons-round">person_search</span>
        <h3>Nenhum cliente encontrado</h3>
        <p>Tente outra busca ou adicione um novo cliente</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = clientesFiltrados.map(c => `
    <div class="card ${c.tipo}" onclick="abrirDetalheCliente('${c.id}')">
      <div class="card-header">
        <div class="card-title">${c.nome}</div>
        <span class="card-badge ${c.tipo}">${formatarTipo(c.tipo)}</span>
      </div>
      <div class="card-info">
        <span class="card-info-item">
          <span class="material-icons-round">phone</span>
          ${c.telefone || 'Sem telefone'}
        </span>
        ${c.tipo === 'pilates' ? `
          <span class="card-info-item">
            <span class="material-icons-round">event</span>
            ${c.frequenciaSemanal}x/semana
          </span>
          <span class="card-info-item status-badge status-${c.statusPagamento}">
            ${c.statusPagamento === 'pago' ? '✓ Pago' : c.statusPagamento === 'atrasado' ? '! Atrasado' : '⏳ Pendente'}
          </span>
        ` : ''}
        ${c.tipo === 'reabilitacao' && c.pacote ? `
          <span class="card-info-item">
            <span class="material-icons-round">inventory_2</span>
            ${c.pacote.sessoesRestantes}/${c.pacote.totalSessoes} sessões
          </span>
        ` : ''}
        ${c.pausado ? '<span class="card-info-item status-badge status-pausado">⏸️ Pausado</span>' : ''}
      </div>
    </div>
  `).join('');
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
  
  switch(state.filtroFinanceiro) {
    case 'resumo': renderizarResumoFinanceiro(container); break;
    case 'mensalidades': renderizarMensalidades(container); break;
    case 'pacotes': renderizarPacotes(container); break;
    case 'comissoes': renderizarComissoes(container); break;
  }
}

function filtrarFinanceiro(filtro) {
  state.filtroFinanceiro = filtro;
  document.querySelectorAll('#pageFinanceiro .filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.filter === filtro);
  });
  carregarFinanceiro();
}

function renderizarResumoFinanceiro(container) {
  const dados = { totalMes: 3250.00, recebido: 2100.00, pendente: 1150.00, comissoes: 840.00, atendimentos: 45 };
  
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
    
    <h3 style="font-family: 'Cormorant Garamond', serif; margin: 20px 0 12px; color: var(--text-dark);">Próximos Vencimentos</h3>
    
    <div class="card">
      <div class="card-header">
        <div class="card-title">Maria Silva</div>
        <span class="status-badge status-pendente">Vence em 3 dias</span>
      </div>
      <div class="card-info">
        <span>Pilates 2x/semana</span>
        <span style="font-weight: 600; color: var(--primary);">${formatarMoeda(280)}</span>
      </div>
    </div>
    
    <div class="card">
      <div class="card-header">
        <div class="card-title">João Santos</div>
        <span class="status-badge status-atrasado">Atrasado 5 dias</span>
      </div>
      <div class="card-info">
        <span>Pilates 3x/semana</span>
        <span style="font-weight: 600; color: var(--danger);">${formatarMoeda(380)}</span>
      </div>
    </div>
  `;
}

function renderizarMensalidades(container) {
  container.innerHTML = `<div class="empty-state"><span class="material-icons-round">payments</span><h3>Mensalidades</h3><p>Configure a API para ver os dados</p></div>`;
}

function renderizarPacotes(container) {
  container.innerHTML = `<div class="empty-state"><span class="material-icons-round">inventory_2</span><h3>Pacotes de Reabilitação</h3><p>Configure a API para ver os dados</p></div>`;
}

function renderizarComissoes(container) {
  container.innerHTML = `
    <div class="finance-summary">
      <div class="finance-card highlight" style="background: linear-gradient(145deg, var(--pilates) 0%, #5a4a8a 100%);">
        <div class="finance-value">${formatarMoeda(840)}</div>
        <div class="finance-label">Comissões do Mês</div>
      </div>
      <div class="finance-card">
        <div class="finance-value">${formatarMoeda(720)}</div>
        <div class="finance-label">Mensalidades (40%)</div>
      </div>
      <div class="finance-card">
        <div class="finance-value">${formatarMoeda(120)}</div>
        <div class="finance-label">Aulas Avulsas</div>
      </div>
    </div>
    
    <h3 style="font-family: 'Cormorant Garamond', serif; margin: 20px 0 12px; color: var(--text-dark);">Detalhamento</h3>
    
    <div class="card pilates">
      <div class="card-header">
        <div class="card-title">Mensalidades</div>
        <span style="font-weight: 600; color: var(--pilates);">${formatarMoeda(720)}</span>
      </div>
      <div class="card-info"><span>6 alunos × 40% média</span></div>
    </div>
    
    <div class="card pilates">
      <div class="card-header">
        <div class="card-title">Aulas Avulsas</div>
        <span style="font-weight: 600; color: var(--pilates);">${formatarMoeda(120)}</span>
      </div>
      <div class="card-info"><span>11 aulas × R$ 10,80</span></div>
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
        <input type="number" class="form-input" name="diaVencimento" min="1" max="31" placeholder="Ex: 10">
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
          <div><label class="form-label" style="font-size: 0.7rem;">Nº de Sessões</label><input type="number" class="form-input" name="totalSessoes" placeholder="Ex: 10"></div>
          <div><label class="form-label" style="font-size: 0.7rem;">Valor Total</label><input type="text" class="form-input" name="valorPacote" placeholder="Ex: 800,00"></div>
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
        <input type="text" class="form-input" name="valorSessao" placeholder="Ex: 120,00">
      </div>
    `;
  }
  
  const conteudo = `
    <form id="formNovoCliente" onsubmit="salvarCliente(event, '${tipo}')">
      <input type="hidden" name="tipo" value="${tipo}">
      <div class="form-group">
        <label class="form-label">Nome Completo</label>
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

function abrirModalAulaAvulsa() {
  abrirModal('📝 Aula Avulsa', `
    <form id="formAulaAvulsa" onsubmit="salvarAulaAvulsa(event)">
      <div class="form-group">
        <label class="form-label">Nome do Aluno</label>
        <input type="text" class="form-input" name="nomeAluno" required placeholder="Nome do aluno">
        <div class="form-hint">Aluno de outra fisioterapeuta</div>
      </div>
      <div class="form-group">
        <label class="form-label">Data da Aula</label>
        <input type="date" class="form-input" name="data" required value="${formatarData(new Date())}">
      </div>
      <div class="form-group">
        <label class="form-label">Horário</label>
        <input type="time" class="form-input" name="hora" required value="08:00">
      </div>
      <div class="form-group">
        <label class="form-label">Valor da Aula</label>
        <input type="text" class="form-input" name="valor" value="27,00" required>
        <div class="form-hint">Sua comissão: ${formatarMoeda(CONFIG.VALOR_AULA_AVULSA * CONFIG.COMISSAO_PILATES)}</div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary"><span class="material-icons-round">check</span> Registrar</button>
      </div>
    </form>
  `);
}

function abrirDetalheAtendimento(id) {
  const ag = state.agendaHoje.find(a => a.id === id);
  if (!ag) return;
  
  abrirModal('Detalhes', `
    <div style="text-align: center; padding: 16px; background: var(--cream-light); border-radius: var(--radius); margin-bottom: 16px;">
      <div style="font-size: 1.4rem; font-weight: 600; color: var(--text-dark); font-family: 'Cormorant Garamond', serif;">${ag.nome}</div>
      <div style="color: var(--text-muted); margin-top: 4px;">${ag.hora} • ${formatarTipo(ag.tipo)}</div>
      <span class="card-badge ${ag.tipo}" style="margin-top: 8px; display: inline-block;">${ag.local === 'domicilio' ? '🏠 Domicílio' : '🏢 Clínica'}</span>
    </div>
    ${ag.status !== 'realizado' && ag.status !== 'faltou' ? `
      <div class="form-actions" style="margin-bottom: 16px;">
        <button class="btn btn-primary" onclick="marcarRealizado('${ag.id}')"><span class="material-icons-round">check_circle</span> Realizado</button>
        <button class="btn btn-accent" onclick="abrirModalFalta('${ag.id}')"><span class="material-icons-round">cancel</span> Falta</button>
      </div>
    ` : `
      <div style="text-align: center; padding: 12px; background: ${ag.status === 'realizado' ? 'var(--primary-ultra-light)' : 'rgba(199, 107, 107, 0.1)'}; border-radius: var(--radius); margin-bottom: 16px;">
        <span style="color: ${ag.status === 'realizado' ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${ag.status === 'realizado' ? '✓ Atendimento Realizado' : '✗ Falta Registrada'}</span>
      </div>
    `}
    <button class="btn btn-outline btn-block" onclick="fecharModal(); abrirDetalheCliente('${ag.clienteId}')">
      <span class="material-icons-round">person</span> Ver Perfil do ${ag.tipo === 'pilates' ? 'Aluno' : 'Paciente'}
    </button>
  `);
}

function abrirModalFalta(id) {
  abrirModal('Falta', `
    <div style="text-align: center; margin-bottom: 20px;">
      <span class="material-icons-round" style="font-size: 3rem; color: var(--warning);">warning</span>
      <h3 style="margin-top: 12px; font-family: 'Cormorant Garamond', serif;">Registrar Falta</h3>
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
      <button class="btn btn-accent" onclick="confirmarFalta('${id}')"><span class="material-icons-round">check</span> Confirmar</button>
    </div>
  `);
}

function abrirDetalheCliente(id) {
  const cliente = state.clientes.find(c => c.id === id) || gerarClientesExemplo().find(c => c.id === id);
  if (cliente) renderizarDetalheCliente(cliente);
}

function renderizarDetalheCliente(c) {
  let infoEspecifica = '';
  
  if (c.tipo === 'pilates') {
    infoEspecifica = `
      <div class="finance-summary" style="margin-bottom: 16px;">
        <div class="finance-card"><div class="finance-value">${c.frequenciaSemanal}x</div><div class="finance-label">Por Semana</div></div>
        <div class="finance-card"><div class="finance-value">${formatarMoeda(CONFIG.PLANOS_PILATES[c.frequenciaSemanal])}</div><div class="finance-label">Mensalidade</div></div>
      </div>
      <div class="card" style="margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">Vencimento</span><strong>Dia ${c.diaVencimento}</strong></div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px;"><span style="color: var(--text-muted);">Status</span><span class="status-badge status-${c.statusPagamento}">${c.statusPagamento === 'pago' ? '✓ Pago' : c.statusPagamento === 'atrasado' ? '! Atrasado' : '⏳ Pendente'}</span></div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px;"><span style="color: var(--text-muted);">Sua Comissão</span><strong style="color: var(--pilates);">${formatarMoeda(CONFIG.PLANOS_PILATES[c.frequenciaSemanal] * CONFIG.COMISSAO_PILATES)}</strong></div>
      </div>
      ${c.reposicoePendentes > 0 ? `<div class="card" style="border-left-color: var(--warning); margin-bottom: 16px;"><div style="color: var(--warning); font-weight: 600;"><span class="material-icons-round" style="vertical-align: middle;">event_repeat</span> ${c.reposicoePendentes} reposição pendente</div></div>` : ''}
    `;
  } else if (c.tipo === 'reabilitacao' && c.pacote) {
    const percentual = (c.pacote.sessoesRestantes / c.pacote.totalSessoes) * 100;
    infoEspecifica = `
      <div class="card" style="margin-bottom: 16px;">
        <div class="card-title" style="margin-bottom: 12px;">📦 Pacote</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;"><span style="color: var(--text-muted);">Sessões</span><strong>${c.pacote.sessoesRestantes}/${c.pacote.totalSessoes} restantes</strong></div>
        <div style="background: var(--cream); border-radius: 4px; height: 8px; overflow: hidden; margin-bottom: 8px;"><div style="background: var(--reabilitacao); height: 100%; width: ${percentual}%;"></div></div>
        <div style="display: flex; justify-content: space-between;"><span style="color: var(--text-muted);">Valor Total</span><strong>${formatarMoeda(c.pacote.valorTotal)}</strong></div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px;"><span style="color: var(--text-muted);">Validade</span><strong>${new Date(c.pacote.validade).toLocaleDateString('pt-BR')}</strong></div>
      </div>
    `;
  }
  
  abrirModal(c.nome, `
    <div style="text-align: center; padding: 16px; background: var(--cream-light); border-radius: var(--radius); margin-bottom: 16px;">
      <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--${c.tipo}); color: white; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 1.5rem; font-family: 'Cormorant Garamond', serif;">${c.nome.charAt(0)}</div>
      <div style="font-size: 1.4rem; font-weight: 600; color: var(--text-dark); font-family: 'Cormorant Garamond', serif;">${c.nome}</div>
      <span class="card-badge ${c.tipo}" style="margin-top: 8px; display: inline-block;">${formatarTipo(c.tipo)}</span>
      ${c.pausado ? '<div class="status-badge status-pausado" style="margin-top: 8px;">⏸️ Pausado</div>' : ''}
    </div>
    <div class="card" style="margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;"><span class="material-icons-round" style="color: var(--text-muted);">phone</span><span>${c.telefone || 'Sem telefone'}</span></div>
      ${c.endereco ? `<div style="display: flex; align-items: center; gap: 8px;"><span class="material-icons-round" style="color: var(--text-muted);">location_on</span><span>${c.endereco}</span></div>` : ''}
    </div>
    ${infoEspecifica}
    ${c.agendaFixa ? `<div class="card" style="margin-bottom: 16px;"><div class="card-title" style="margin-bottom: 8px;">📅 Horários Fixos</div><div style="color: var(--text-medium);">${c.agendaFixa}</div></div>` : ''}
    <div class="form-actions" style="margin-bottom: 12px;">
      <button class="btn btn-primary" onclick="fecharModal(); abrirWhatsApp('${c.telefone}')"><span class="material-icons-round">send</span> WhatsApp</button>
      <button class="btn btn-secondary" onclick="editarCliente('${c.id}')"><span class="material-icons-round">edit</span> Editar</button>
    </div>
    <button class="btn ${c.pausado ? 'btn-primary' : 'btn-accent'} btn-block" onclick="togglePausaCliente('${c.id}', ${c.pausado})">
      <span class="material-icons-round">${c.pausado ? 'play_arrow' : 'pause'}</span> ${c.pausado ? 'Reativar' : 'Pausar'} ${c.tipo === 'pilates' ? 'Aluno' : 'Paciente'}
    </button>
  `);
}

// ============================================
// MAIS OPÇÕES
// ============================================
function abrirRelatorios() {
  abrirModal('📊 Relatórios', `<div class="menu-list">
    <button class="menu-item" onclick="toast('Em desenvolvimento', 'info')"><span class="material-icons-round">calendar_month</span><span>Relatório Mensal</span></button>
    <button class="menu-item" onclick="toast('Em desenvolvimento', 'info')"><span class="material-icons-round">payments</span><span>Comissões Pilates</span></button>
    <button class="menu-item" onclick="toast('Em desenvolvimento', 'info')"><span class="material-icons-round">warning</span><span>Inadimplentes</span></button>
  </div>`);
}

function abrirAulasAvulsas() {
  abrirModal('📝 Aulas Avulsas', `
    <div class="finance-card" style="margin-bottom: 16px;"><div class="finance-value" style="color: var(--pilates);">${formatarMoeda(118.80)}</div><div class="finance-label">Comissão do Mês (11 aulas)</div></div>
    <button class="btn btn-primary btn-block" onclick="fecharModal(); abrirModalAulaAvulsa()"><span class="material-icons-round">add</span> Nova Aula Avulsa</button>
  `);
}

function abrirReposicoes() {
  abrirModal('🔄 Reposições Pendentes', `<p style="color: var(--text-muted); margin-bottom: 16px;">Alunos com faltas justificadas aguardando reposição.</p>
    <div class="card pilates"><div class="card-header"><div class="card-title">Maria Silva</div><span class="status-badge status-pendente">1 reposição</span></div><div class="card-info"><span>Falta em 28/01/2026</span></div></div>
  `);
}

function abrirConfiguracoes() {
  abrirModal('⚙️ Configurações', `<div class="menu-list">
    <button class="menu-item" onclick="abrirConfigAPI()"><span class="material-icons-round">link</span><span>Configurar API</span></button>
    <button class="menu-item" onclick="toast('Em desenvolvimento', 'info')"><span class="material-icons-round">attach_money</span><span>Valores e Planos</span></button>
  </div>
  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--cream);"><p style="font-size: 0.8rem; color: var(--text-muted); text-align: center;">Dr. Lucas Cordeiro - Fisioterapeuta<br>Versão 1.0.0</p></div>`);
}

function abrirConfigAPI() {
  abrirModal('🔗 Configurar API', `<form onsubmit="salvarConfigAPI(event)">
    <div class="form-group"><label class="form-label">URL do Google Apps Script</label><input type="url" class="form-input" name="apiUrl" value="${CONFIG.API_URL}" placeholder="https://script.google.com/macros/s/.../exec"><div class="form-hint">Cole a URL da implantação do Apps Script</div></div>
    <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button type="submit" class="btn btn-primary">Salvar</button></div>
  </form>`);
}

function salvarConfigAPI(event) {
  event.preventDefault();
  CONFIG.API_URL = event.target.apiUrl.value;
  localStorage.setItem('apiUrl', CONFIG.API_URL);
  toast('API configurada!', 'success');
  fecharModal();
}

function abrirModalNovoAgendamento(data, hora) {
  abrirModal('📅 Novo Agendamento', `<form onsubmit="salvarAgendamento(event)">
    <input type="hidden" name="data" value="${data}"><input type="hidden" name="hora" value="${hora}">
    <div style="text-align: center; padding: 12px; background: var(--cream-light); border-radius: var(--radius); margin-bottom: 16px;"><strong>${new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</strong><br>às <strong>${hora}</strong></div>
    <div class="form-group"><label class="form-label">Cliente</label><select class="form-select" name="clienteId" required><option value="">Selecione...</option>${state.clientes.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select></div>
    <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button type="submit" class="btn btn-primary">Agendar</button></div>
  </form>`);
}

function abrirModalAgendamentoRapido() {
  abrirModal('⚡ Agendamento Rápido', `<form onsubmit="salvarAgendamento(event)">
    <div class="form-group"><label class="form-label">Cliente</label><input type="text" class="form-input" name="nomeCliente" required placeholder="Nome"></div>
    <div class="form-row"><div class="form-group"><label class="form-label">Data</label><input type="date" class="form-input" name="data" required value="${formatarData(new Date())}"></div><div class="form-group"><label class="form-label">Hora</label><input type="time" class="form-input" name="hora" required value="08:00"></div></div>
    <div class="form-actions"><button type="button" class="btn btn-secondary" onclick="fecharModal()">Cancelar</button><button type="submit" class="btn btn-primary">Agendar</button></div>
  </form>`);
}

// ============================================
// AÇÕES
// ============================================
function marcarRealizado(id) { toast('Atendimento realizado!', 'success'); fecharModal(); carregarAgendaHoje(); }
function confirmarFalta(id) { const tipo = document.querySelector('input[name="tipoFalta"]:checked')?.value; toast(tipo === 'justificada' ? 'Falta justificada. Reposição pendente.' : 'Falta registrada.', tipo === 'justificada' ? 'warning' : 'info'); fecharModal(); carregarAgendaHoje(); }
function salvarCliente(event, tipo) { event.preventDefault(); toast('Cadastrado com sucesso!', 'success'); fecharModal(); carregarClientes(); }
function salvarAulaAvulsa(event) { event.preventDefault(); toast('Aula avulsa registrada!', 'success'); fecharModal(); }
function salvarAgendamento(event) { event.preventDefault(); toast('Agendamento criado!', 'success'); fecharModal(); carregarAgendaSemanal(); }
function togglePausaCliente(id, pausado) { toast(`Cliente ${pausado ? 'reativado' : 'pausado'}!`, 'success'); fecharModal(); carregarClientes(); }
function editarCliente(id) { toast('Em desenvolvimento', 'info'); }
function abrirWhatsApp(tel) { if (!tel) { toast('Sem telefone', 'warning'); return; } const t = tel.replace(/\D/g, ''); window.open(`https://wa.me/${t.startsWith('55') ? t : '55' + t}`, '_blank'); }

// ============================================
// UTILITÁRIOS
// ============================================
function toast(msg, tipo = 'info') { const t = document.createElement('div'); t.className = `toast ${tipo}`; t.textContent = msg; document.getElementById('toastContainer').appendChild(t); setTimeout(() => t.remove(), 3000); }
function formatarMoeda(v) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0); }
function formatarData(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function formatarTipo(t) { return { pilates: 'Pilates', reabilitacao: 'Reabilitação', terapia: 'Terapia Manual' }[t] || t; }
function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function getInicioSemana(d) { const x = new Date(d); x.setDate(x.getDate() - x.getDay() + (x.getDay() === 0 ? -6 : 1)); x.setHours(0,0,0,0); return x; }
function isMesmaData(a, b) { return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear(); }

// ============================================
// DADOS DE EXEMPLO
// ============================================
function gerarDadosExemplo() {
  return [
    { id: '1', nome: 'Maria Silva', tipo: 'pilates', hora: '08:00', local: 'clinica', status: 'agendado', totalAlunos: 3, clienteId: 'c1' },
    { id: '2', nome: 'João Santos', tipo: 'pilates', hora: '08:00', local: 'clinica', status: 'agendado', clienteId: 'c2' },
    { id: '3', nome: 'Ana Costa', tipo: 'pilates', hora: '08:00', local: 'clinica', status: 'agendado', clienteId: 'c3' },
    { id: '4', nome: 'Carlos Oliveira', tipo: 'reabilitacao', hora: '09:00', local: 'clinica', status: 'agendado', clienteId: 'c4' },
    { id: '5', nome: 'Paula Lima', tipo: 'pilates', hora: '10:00', local: 'clinica', status: 'realizado', totalAlunos: 2, clienteId: 'c5' },
    { id: '6', nome: 'Pedro Alves', tipo: 'terapia', hora: '14:00', local: 'domicilio', status: 'agendado', clienteId: 'c6' },
    { id: '7', nome: 'Lucia Fernandes', tipo: 'reabilitacao', hora: '15:00', local: 'clinica', status: 'agendado', clienteId: 'c7' },
    { id: '8', nome: 'Roberto Dias', tipo: 'pilates', hora: '17:00', local: 'clinica', status: 'agendado', totalAlunos: 4, clienteId: 'c8' },
  ];
}

function gerarDadosExemploSemana(inicio) {
  const dados = [], tipos = ['pilates', 'reabilitacao', 'terapia'], nomes = ['Maria', 'João', 'Ana', 'Carlos', 'Paula', 'Pedro'];
  for (let i = 0; i < 6; i++) { const dia = new Date(inicio); dia.setDate(inicio.getDate() + i); const ds = formatarData(dia);
    CONFIG.HORARIOS.forEach(h => { if (Math.random() > 0.7) dados.push({ id: `ag-${ds}-${h}`, nome: nomes[Math.floor(Math.random() * nomes.length)], tipo: tipos[Math.floor(Math.random() * tipos.length)], data: ds, hora: h, local: Math.random() > 0.8 ? 'domicilio' : 'clinica', status: Math.random() > 0.8 ? 'realizado' : 'agendado' }); });
  } return dados;
}

function gerarClientesExemplo() {
  return [
    { id: 'c1', nome: 'Maria Silva', tipo: 'pilates', telefone: '(88) 99999-1111', frequenciaSemanal: 2, diaVencimento: 10, statusPagamento: 'pago', agendaFixa: 'SEG 08:00, QUA 08:00', reposicoePendentes: 1 },
    { id: 'c2', nome: 'João Santos', tipo: 'pilates', telefone: '(88) 99999-2222', frequenciaSemanal: 3, diaVencimento: 15, statusPagamento: 'atrasado', agendaFixa: 'SEG 08:00, QUA 08:00, SEX 08:00' },
    { id: 'c3', nome: 'Ana Costa', tipo: 'pilates', telefone: '(88) 99999-3333', frequenciaSemanal: 2, diaVencimento: 5, statusPagamento: 'pendente', agendaFixa: 'TER 10:00, QUI 10:00' },
    { id: 'c4', nome: 'Carlos Oliveira', tipo: 'reabilitacao', telefone: '(88) 99999-4444', endereco: 'Rua das Flores, 123', pacote: { totalSessoes: 10, sessoesRestantes: 7, valorTotal: 800, validade: '2026-03-15' }, agendaFixa: 'SEG 09:00, QUI 09:00' },
    { id: 'c5', nome: 'Paula Lima', tipo: 'pilates', telefone: '(88) 99999-5555', frequenciaSemanal: 1, diaVencimento: 20, statusPagamento: 'pago', agendaFixa: 'QUA 10:00', pausado: true },
    { id: 'c6', nome: 'Pedro Alves', tipo: 'terapia', telefone: '(88) 99999-6666', endereco: 'Av. Principal, 456', valorSessao: 150 },
    { id: 'c7', nome: 'Lucia Fernandes', tipo: 'reabilitacao', telefone: '(88) 99999-7777', pacote: { totalSessoes: 8, sessoesRestantes: 2, valorTotal: 640, validade: '2026-02-28' }, agendaFixa: 'TER 15:00, SEX 15:00' },
    { id: 'c8', nome: 'Roberto Dias', tipo: 'pilates', telefone: '(88) 99999-8888', frequenciaSemanal: 2, diaVencimento: 1, statusPagamento: 'pago', agendaFixa: 'SEG 17:00, QUI 17:00' },
  ];
}

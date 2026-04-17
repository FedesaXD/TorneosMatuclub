// ============================================================
// DASHBOARD MODULE
// ============================================================

let currentProfile = null;
let allTournaments = [];
let myTeam = null;
let currentTournamentId = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  currentProfile = await requireAuth(false);
  if (!currentProfile) return;

  renderUserChip(currentProfile);
  await loadTournaments();
  await loadMyTeam();
});

// ============================================================
// SECTION NAVIGATION
// ============================================================
function showSection(name) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`nav-${name}`).classList.add('active');

  if (name === 'bracket') loadBracket();
  if (name === 'results') loadPendingMatches();
  if (name === 'myteam') renderMyTeam();
}

// ============================================================
// TOURNAMENTS
// ============================================================
async function loadTournaments() {
  const { data, error } = await sb
    .from('tournaments')
    .select('*, teams(count)')
    .order('start_date', { ascending: true });

  if (error) {
    document.getElementById('tournamentGrid').innerHTML = `<div class="empty-state"><p class="text-danger">Error cargando torneos</p></div>`;
    return;
  }

  allTournaments = data || [];
  renderTournaments(allTournaments);
}

function renderTournaments(list) {
  const grid = document.getElementById('tournamentGrid');
  if (!list.length) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><h3>Sin torneos disponibles</h3><p>El admin creará torneos pronto</p></div>`;
    return;
  }

  grid.innerHTML = list.map(t => {
    const teamCount = t.teams?.[0]?.count || 0;
    const pct = Math.round((teamCount / t.max_teams) * 100);
    const statusBadge = {
      'upcoming': '<span class="badge badge-upcoming">🕐 Próximo</span>',
      'active': '<span class="badge badge-active">🔴 En vivo</span>',
      'closed': '<span class="badge badge-closed">✓ Finalizado</span>',
      'pending': '<span class="badge badge-pending">⏳ Registro</span>'
    }[t.status] || '';
    const formatBadge = t.format === '3v3'
      ? '<span class="badge badge-3v3">3v3</span>'
      : '<span class="badge badge-solo">Solo</span>';

    return `
      <div class="tournament-card" onclick="openTournament('${t.id}')">
        <div class="tournament-card-top">
          ${statusBadge}
          ${formatBadge}
          <div class="tournament-name">${escHtml(t.name)}</div>
          <div class="tournament-meta">
            <span class="tournament-meta-item">📅 ${formatDate(t.start_date)}</span>
            <span class="tournament-meta-item">👥 ${t.format === '3v3' ? '3 por equipo' : '1v1'}</span>
            <span class="tournament-meta-item">🎮 ${t.game_mode || 'Brawl Stars'}</span>
          </div>
        </div>
        <div class="tournament-card-body">
          ${t.prize ? `<div class="tournament-prize-lbl">Premio</div><div class="tournament-prize">🏅 ${escHtml(t.prize)}</div>` : ''}
          <div class="slot-bar">
            <div class="slot-bar-track"><div class="slot-bar-fill" style="width:${pct}%"></div></div>
            <div class="slot-label">${teamCount} / ${t.max_teams} equipos registrados</div>
          </div>
          <button class="btn btn-primary btn-sm mt-1" onclick="event.stopPropagation();openTournament('${t.id}')">
            Ver detalles →
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterTourneys(filter, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  let filtered = allTournaments;
  if (filter === 'upcoming') filtered = allTournaments.filter(t => t.status === 'upcoming');
  else if (filter === 'active') filtered = allTournaments.filter(t => t.status === 'active');
  else if (filter === '3v3') filtered = allTournaments.filter(t => t.format === '3v3');
  else if (filter === 'solo') filtered = allTournaments.filter(t => t.format === 'solo');
  
  renderTournaments(filtered);
}

// ============================================================
// TOURNAMENT DETAIL MODAL
// ============================================================
async function openTournament(id) {
  currentTournamentId = id;
  const tourney = allTournaments.find(t => t.id === id);
  if (!tourney) return;

  // Load teams for this tournament
  const { data: teams } = await sb
    .from('teams')
    .select('*, team_members(*, profiles(nickname, brawl_tag))')
    .eq('tournament_id', id)
    .order('created_at');

  const isRegistered = teams?.some(t =>
    t.team_members?.some(m => m.profile_id === currentProfile.id)
  );

  const canRegister = ['pending', 'upcoming'].includes(tourney.status) && !isRegistered && (teams?.length || 0) < tourney.max_teams;

  document.getElementById('tourneyModalContent').innerHTML = `
    <div class="modal-header">
      <h2>${escHtml(tourney.name)}</h2>
      <p>${tourney.description || 'Torneo oficial de BrawlArena'}</p>
    </div>

    <div class="grid-2 mb-2">
      <div class="card">
        <div class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Formato</div>
        <div style="font-family:var(--font-cond);font-size:20px;font-weight:700">${tourney.format === '3v3' ? '3v3 — Equipos de 3' : 'Solo — 1 jugador'}</div>
      </div>
      <div class="card">
        <div class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Inicio</div>
        <div style="font-family:var(--font-cond);font-size:20px;font-weight:700">${formatDate(tourney.start_date)}</div>
      </div>
      ${tourney.prize ? `
      <div class="card">
        <div class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Premio</div>
        <div class="tournament-prize" style="font-size:22px">${escHtml(tourney.prize)}</div>
      </div>` : ''}
      <div class="card">
        <div class="text-muted" style="font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Equipos</div>
        <div style="font-family:var(--font-cond);font-size:20px;font-weight:700">${teams?.length || 0} / ${tourney.max_teams}</div>
      </div>
    </div>

    <div style="margin-bottom:1.5rem">
      <div style="font-family:var(--font-cond);font-size:16px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
        Equipos Registrados
      </div>
      ${renderTeamList(teams || [], tourney, isRegistered)}
    </div>

    ${canRegister ? `
    <div class="flex gap-2">
      <button class="btn btn-primary" onclick="openCreateTeam('${id}')">+ Crear Equipo</button>
    </div>` : ''}
    ${isRegistered ? `<div class="form-success">✓ Ya estás registrado en este torneo</div>` : ''}
    ${tourney.status === 'closed' ? `<div class="badge badge-closed" style="padding:8px 16px">Torneo finalizado</div>` : ''}
  `;

  showModal('tourneyModal');
}

function renderTeamList(teams, tourney, isRegistered) {
  if (!teams.length) {
    return `<div class="empty-state" style="padding:1.5rem"><div class="empty-state-icon">👥</div><p>Sin equipos aún. ¡Sé el primero!</p></div>`;
  }

  return teams.map(team => {
    const members = team.team_members || [];
    const slots = tourney.format === '3v3' ? 3 : 1;
    const isMember = members.some(m => m.profile_id === currentProfile.id);
    const canJoin = !isRegistered && members.length < slots && ['pending','upcoming'].includes(tourney.status);

    return `
      <div class="card mb-1" style="margin-bottom:8px">
        <div class="flex-between mb-1">
          <span style="font-family:var(--font-cond);font-size:18px;font-weight:700">${escHtml(team.name)}</span>
          ${isMember ? '<span class="badge badge-active">Tu equipo</span>' : ''}
        </div>
        <div class="team-slots">
          ${Array.from({length: slots}).map((_, i) => {
            const m = members[i];
            return m ? `
              <div class="team-slot filled">
                <div class="slot-num">${i+1}</div>
                <div class="slot-info">
                  <div class="slot-nick">${escHtml(m.profiles?.nickname || '?')}</div>
                  <div class="slot-tag">${escHtml(m.profiles?.brawl_tag || '')}</div>
                </div>
                ${m.is_captain ? '<span class="badge badge-upcoming" style="font-size:10px">Capitán</span>' : ''}
              </div>
            ` : `
              <div class="team-slot empty">
                <div class="slot-num">${i+1}</div>
                <div class="slot-info" style="color:var(--text3);font-style:italic">Lugar disponible</div>
                ${canJoin ? `<button class="btn btn-sm btn-outline" onclick="joinTeam('${team.id}')">Unirse</button>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================
// TEAM MANAGEMENT
// ============================================================
async function loadMyTeam() {
  const { data } = await sb
    .from('team_members')
    .select('teams(*, tournaments(*), team_members(*, profiles(nickname, brawl_tag)))')
    .eq('profile_id', currentProfile.id)
    .maybeSingle();

  myTeam = data?.teams || null;
}

function renderMyTeam() {
  const el = document.getElementById('myTeamContent');
  
  if (!myTeam) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👥</div>
        <h3>Sin equipo</h3>
        <p>Únete a un torneo y crea o únete a un equipo</p>
        <button class="btn btn-primary mt-2" onclick="showSection('tournaments')">Ver Torneos</button>
      </div>`;
    return;
  }

  const tourney = myTeam.tournaments;
  const members = myTeam.team_members || [];
  const slots = tourney?.format === '3v3' ? 3 : 1;

  el.innerHTML = `
    <div class="card card-neon mb-2">
      <div class="flex-between mb-2">
        <div>
          <div class="text-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:1px">Equipo</div>
          <div style="font-family:var(--font-display);font-size:36px;color:var(--neon)">${escHtml(myTeam.name)}</div>
        </div>
        <div style="text-align:right">
          <div class="text-muted" style="font-size:12px;text-transform:uppercase;letter-spacing:1px">Torneo</div>
          <div style="font-family:var(--font-cond);font-size:20px;font-weight:700">${escHtml(tourney?.name || '?')}</div>
          <div class="text-muted" style="font-size:12px">${formatDate(tourney?.start_date)}</div>
        </div>
      </div>
      
      <div class="team-slots">
        ${Array.from({length: slots}).map((_, i) => {
          const m = members[i];
          return m ? `
            <div class="team-slot filled">
              <div class="slot-num">${i+1}</div>
              <div class="slot-info">
                <div class="slot-nick">${escHtml(m.profiles?.nickname || '?')}</div>
                <div class="slot-tag">${escHtml(m.profiles?.brawl_tag || '')}</div>
              </div>
              ${m.is_captain ? '<span class="badge badge-upcoming">Capitán</span>' : ''}
              ${m.profile_id === currentProfile.id ? '<span class="badge badge-active">Tú</span>' : ''}
            </div>
          ` : `
            <div class="team-slot empty">
              <div class="slot-num">${i+1}</div>
              <div class="slot-info" style="color:var(--text3);font-style:italic">Esperando jugador...</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div style="font-family:var(--font-cond);font-size:16px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Estado del Torneo</div>
      <div class="flex gap-2 wrap">
        <span class="badge ${tourney?.status === 'active' ? 'badge-active' : tourney?.status === 'pending' ? 'badge-pending' : 'badge-upcoming'}">
          ${tourney?.status === 'active' ? '🔴 En curso' : tourney?.status === 'pending' ? '⏳ Registro abierto' : '🕐 Próximamente'}
        </span>
        ${tourney?.status === 'active' ? `
          <button class="btn btn-sm btn-outline" onclick="showSection('bracket')">Ver Bracket</button>
          <button class="btn btn-sm btn-primary" onclick="showSection('results')">Subir Resultado</button>
        ` : ''}
      </div>
    </div>
  `;
}

function openCreateTeam(tournamentId) {
  document.getElementById('teamTournamentId').value = tournamentId;
  closeModal('tourneyModal');
  showModal('createTeamModal');
}

async function handleCreateTeam(e) {
  e.preventDefault();
  const name = document.getElementById('teamName').value.trim();
  const tournamentId = document.getElementById('teamTournamentId').value;
  const errEl = document.getElementById('createTeamError');
  const btn = document.getElementById('createTeamBtn');

  errEl.classList.add('hidden');
  setLoading(btn, true);

  try {
    // Check name uniqueness within tournament
    const { data: existing } = await sb
      .from('teams')
      .select('id')
      .eq('tournament_id', tournamentId)
      .eq('name', name)
      .maybeSingle();

    if (existing) {
      showFormError(errEl, 'Ya existe un equipo con ese nombre en este torneo.');
      setLoading(btn, false);
      return;
    }

    // Create team
    const { data: team, error: teamError } = await sb
      .from('teams')
      .insert({ name, tournament_id: tournamentId })
      .select()
      .single();

    if (teamError) {
      showFormError(errEl, 'Error al crear el equipo: ' + teamError.message);
      setLoading(btn, false);
      return;
    }

    // Add creator as captain
    const { error: memberError } = await sb
      .from('team_members')
      .insert({ team_id: team.id, profile_id: currentProfile.id, is_captain: true });

    if (memberError) {
      showFormError(errEl, 'Error al unirte al equipo: ' + memberError.message);
      setLoading(btn, false);
      return;
    }

    closeModal('createTeamModal');
    showToast('¡Equipo creado! Comparte el nombre con tus compañeros.', 'success');
    await loadTournaments();
    await loadMyTeam();
    renderMyTeam();
    setLoading(btn, false);

  } catch (err) {
    showFormError(errEl, 'Error inesperado: ' + err.message);
    setLoading(btn, false);
  }
}

async function joinTeam(teamId) {
  try {
    const { error } = await sb
      .from('team_members')
      .insert({ team_id: teamId, profile_id: currentProfile.id, is_captain: false });

    if (error) {
      showToast('Error al unirte: ' + error.message, 'error');
      return;
    }

    showToast('¡Te uniste al equipo!', 'success');
    await loadTournaments();
    await loadMyTeam();
    closeModal('tourneyModal');
  } catch (err) {
    showToast('Error inesperado', 'error');
  }
}

// ============================================================
// BRACKET
// ============================================================
async function loadBracket() {
  if (!myTeam) {
    document.getElementById('bracketContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>No estás en ningún torneo</h3>
        <p>Regístrate en un torneo para ver el bracket</p>
      </div>`;
    return;
  }

  const { data: matches, error } = await sb
    .from('matches')
    .select('*, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), winner:teams!matches_winner_id_fkey(name)')
    .eq('tournament_id', myTeam.tournaments.id)
    .order('round', { ascending: true })
    .order('match_number', { ascending: true });

  if (error || !matches?.length) {
    document.getElementById('bracketContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📊</div>
        <h3>Bracket no disponible</h3>
        <p>El bracket se generará cuando comience el torneo</p>
      </div>`;
    return;
  }

  // Group by round
  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  const roundNames = ['Ronda 1','Cuartos','Semis','Final'];
  const maxRound = Math.max(...Object.keys(rounds).map(Number));

  const bracketHtml = Object.keys(rounds).sort((a,b) => a-b).map((round, i) => {
    const rMatches = rounds[round];
    const name = i >= maxRound - 1 ? 'Final' : i >= maxRound - 2 ? 'Semifinal' : roundNames[i] || `Ronda ${parseInt(round)+1}`;
    
    return `
      <div class="bracket-round">
        <div class="bracket-round-title">${name}</div>
        <div class="bracket-matches">
          ${rMatches.map(m => {
            const myMatch = m.team_a?.name === myTeam.name || m.team_b?.name === myTeam.name;
            return `
              <div class="bracket-match-wrapper">
                <div class="bracket-match" style="${myMatch ? 'border-color:var(--neon);box-shadow:0 0 16px rgba(0,245,255,0.15)' : ''}">
                  <div class="bracket-team ${m.winner_id === m.team_a_id ? 'winner' : m.winner_id ? 'loser' : ''}">
                    <span>${m.team_a?.name || 'TBD'}</span>
                    <span class="bracket-score">${m.score_a ?? ''}</span>
                  </div>
                  <div class="bracket-team ${m.winner_id === m.team_b_id ? 'winner' : m.winner_id ? 'loser' : ''}">
                    <span>${m.team_b?.name || 'TBD'}</span>
                    <span class="bracket-score">${m.score_b ?? ''}</span>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('bracketContent').innerHTML = `
    <div class="bracket-wrapper">
      <div class="bracket">${bracketHtml}</div>
    </div>
  `;
}

// ============================================================
// SUBMIT RESULTS
// ============================================================
async function loadPendingMatches() {
  if (!myTeam) {
    document.getElementById('resultsContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📤</div>
        <h3>No estás en ningún torneo activo</h3>
      </div>`;
    return;
  }

  const { data: matches } = await sb
    .from('matches')
    .select('*, team_a:teams!matches_team_a_id_fkey(id,name), team_b:teams!matches_team_b_id_fkey(id,name)')
    .eq('tournament_id', myTeam.tournaments.id)
    .or(`team_a_id.eq.${myTeam.id},team_b_id.eq.${myTeam.id}`)
    .is('winner_id', null)
    .eq('status', 'pending');

  if (!matches?.length) {
    document.getElementById('resultsContent').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <h3>Sin partidas pendientes</h3>
        <p>Cuando tengas una partida asignada aparecerá aquí</p>
      </div>`;
    return;
  }

  document.getElementById('resultsContent').innerHTML = matches.map(m => `
    <div class="result-card">
      <div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--text3);margin-bottom:8px">
        ${myTeam.tournaments.name} — Ronda ${m.round + 1}
      </div>
      <div class="vs-row">
        <div class="team-block">
          <div class="team-block-name">${escHtml(m.team_a?.name || 'TBD')}</div>
        </div>
        <div class="vs-divider">VS</div>
        <div class="team-block">
          <div class="team-block-name">${escHtml(m.team_b?.name || 'TBD')}</div>
        </div>
      </div>
      <form onsubmit="submitResult(event, '${m.id}', '${m.team_a_id}', '${m.team_b_id}')">
        <div class="grid-2 mb-2">
          <div class="field">
            <label>Puntos ${escHtml(m.team_a?.name || 'Equipo A')}</label>
            <input type="number" name="scoreA" min="0" max="99" placeholder="0" required />
          </div>
          <div class="field">
            <label>Puntos ${escHtml(m.team_b?.name || 'Equipo B')}</label>
            <input type="number" name="scoreB" min="0" max="99" placeholder="0" required />
          </div>
        </div>
        <div class="field mb-2">
          <label>Captura del resultado <span class="req">*</span></label>
          <div class="file-drop" style="padding:16px" onclick="this.nextElementSibling.click()">
            <div class="file-drop-text">📸 Adjunta captura de pantalla</div>
            <div class="file-drop-sub">JPG, PNG — máx. 5MB</div>
          </div>
          <input type="file" name="screenshot" accept="image/*" required style="display:none" />
        </div>
        <button type="submit" class="btn btn-primary">Subir Resultado →</button>
        <small class="text-muted" style="display:block;margin-top:8px">El admin revisará y confirmará el resultado</small>
      </form>
    </div>
  `).join('');
}

async function submitResult(e, matchId, teamAId, teamBId) {
  e.preventDefault();
  const form = e.target;
  const scoreA = parseInt(form.scoreA.value);
  const scoreB = parseInt(form.scoreB.value);
  const file = form.screenshot.files[0];

  if (scoreA === scoreB) {
    showToast('No puede haber empate. Revisa los puntajes.', 'error');
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Subiendo...';

  try {
    // Upload screenshot
    const ext = file.name.split('.').pop();
    const path = `matches/${matchId}_${Date.now()}.${ext}`;
    await sb.storage.from('screenshots').upload(path, file);

    // Submit result for admin review
    const { error } = await sb
      .from('match_results')
      .insert({
        match_id: matchId,
        submitted_by: currentProfile.id,
        score_a: scoreA,
        score_b: scoreB,
        screenshot_path: path,
        status: 'pending_review'
      });

    if (error) {
      showToast('Error: ' + error.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Subir Resultado →';
      return;
    }

    showToast('¡Resultado enviado! El admin lo revisará pronto.', 'success');
    loadPendingMatches();
  } catch (err) {
    showToast('Error inesperado', 'error');
    btn.disabled = false;
    btn.textContent = 'Subir Resultado →';
  }
}

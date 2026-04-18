// ============================================================
// ADMIN MODULE
// ============================================================

let adminProfile = null;
let bracketTournamentId = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  adminProfile = await requireAuth(true);
  if (!adminProfile) return;
  renderUserChip(adminProfile);
  await loadOverview();
});

function showSection(name) {
  document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`section-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`nav-${name}`)?.classList.add('active');

  if (name === 'tournaments') loadAdminTournaments();
  if (name === 'users') loadUsers();
  if (name === 'matches') loadAdminMatches();
  if (name === 'results') loadResultsReview();
}

// ============================================================
// OVERVIEW
// ============================================================
async function loadOverview() {
  const [
    { count: players },
    { count: tournaments },
    { count: pending }
  ] = await Promise.all([
    sb.from('profiles').select('*', { count: 'exact', head: true }).eq('is_admin', false),
    sb.from('tournaments').select('*', { count: 'exact', head: true }),
    sb.from('match_results').select('*', { count: 'exact', head: true }).eq('status', 'pending_review')
  ]);

  document.getElementById('ov-players').textContent = players || 0;
  document.getElementById('ov-tournaments').textContent = tournaments || 0;
  document.getElementById('ov-pending').textContent = pending || 0;
}

// ============================================================
// TOURNAMENTS ADMIN
// ============================================================
async function loadAdminTournaments() {
  const { data, error } = await sb
    .from('tournaments')
    .select('*, teams(count)')
    .order('created_at', { ascending: false });

  const el = document.getElementById('adminTourneyList');
  if (error || !data?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><h3>Sin torneos creados</h3><button class="btn btn-primary mt-2" onclick="showModal('createTourneyModal')">Crear Torneo</button></div>`;
    return;
  }

  el.innerHTML = data.map(t => {
    const teamCount = t.teams?.[0]?.count || 0;
    const statusBadge = {
      'upcoming': '<span class="badge badge-upcoming">🕐 Próximo</span>',
      'active': '<span class="badge badge-active">🔴 En vivo</span>',
      'closed': '<span class="badge badge-closed">✓ Finalizado</span>',
      'pending': '<span class="badge badge-pending">⏳ Registro</span>'
    }[t.status] || '';

    return `
      <div class="card mb-2" style="margin-bottom:12px">
        <div class="flex-between mb-1">
          <div>
            <span style="font-family:var(--font-cond);font-size:22px;font-weight:700;margin-right:12px">${escHtml(t.name)}</span>
            ${statusBadge}
            <span class="badge ${t.format === '3v3' ? 'badge-3v3' : 'badge-solo'}" style="margin-left:4px">${t.format}</span>
          </div>
          <div style="font-size:13px;color:var(--text3)">${formatDate(t.start_date)}</div>
        </div>
        <div class="flex gap-2 wrap" style="font-size:13px;color:var(--text2);margin-bottom:12px">
          <span>👥 ${teamCount}/${t.max_teams} equipos</span>
          <span>🎮 ${t.game_mode || 'Brawl Stars'}</span>
          ${t.prize ? `<span>🏅 ${escHtml(t.prize)}</span>` : ''}
        </div>
        <div class="flex gap-2 wrap">
          ${t.status === 'pending' ? `<button class="btn btn-sm btn-primary" onclick="openGenerateBracket('${t.id}','${escHtml(t.name)}',${teamCount})">⚡ Generar Bracket</button>` : ''}
          ${t.status === 'active' ? `<button class="btn btn-sm btn-outline" onclick="viewBracket('${t.id}')">Ver Bracket</button>` : ''}
          ${t.status !== 'closed' ? `<button class="btn btn-sm btn-danger" onclick="closeTournament('${t.id}')">Cerrar Torneo</button>` : ''}
          <button class="btn btn-sm btn-ghost" onclick="toggleTourneyStatus('${t.id}','${t.status}')">
            ${t.status === 'pending' ? 'Abrir Registro' : t.status === 'upcoming' ? 'Activar' : ''}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function handleCreateTourney(e) {
  e.preventDefault();
  const errEl = document.getElementById('createTourneyError');
  const btn = document.getElementById('createTourneyBtn');
  errEl.classList.add('hidden');
  setLoading(btn, true);

  const dateVal = document.getElementById('tStartDate').value;
  const timeVal = document.getElementById('tStartTime').value;
  const startDateTime = dateVal && timeVal ? `${dateVal}T${timeVal}:00` : null;

  const payload = {
    name: document.getElementById('tName').value.trim(),
    format: document.getElementById('tFormat').value,
    start_date: startDateTime,
    max_teams: parseInt(document.getElementById('tMaxTeams').value),
    game_mode: document.getElementById('tMode').value.trim() || null,
    prize: document.getElementById('tPrize').value.trim() || null,
    description: document.getElementById('tDesc').value.trim() || null,
    status: 'pending'
  };

  const { error } = await sb.from('tournaments').insert(payload);

  if (error) {
    showFormError(errEl, 'Error: ' + error.message);
    setLoading(btn, false);
    return;
  }

  closeModal('createTourneyModal');
  showToast('¡Torneo creado exitosamente!', 'success');
  loadAdminTournaments();
  setLoading(btn, false);
  e.target.reset();
}

async function toggleTourneyStatus(id, currentStatus) {
  const nextStatus = { 'pending': 'upcoming', 'upcoming': 'active' }[currentStatus];
  if (!nextStatus) return;

  await sb.from('tournaments').update({ status: nextStatus }).eq('id', id);
  showToast(`Estado actualizado`, 'success');
  loadAdminTournaments();
}

async function closeTournament(id) {
  if (!confirm('¿Cerrar este torneo? Esta acción marcará el torneo como finalizado.')) return;
  await sb.from('tournaments').update({ status: 'closed' }).eq('id', id);
  showToast('Torneo cerrado', 'success');
  loadAdminTournaments();
}

// ============================================================
// BRACKET GENERATION
// ============================================================
function openGenerateBracket(id, name, teamCount) {
  bracketTournamentId = id;
  document.getElementById('bracketGenInfo').innerHTML = `
    <div class="card">
      <div class="flex-between">
        <span><strong>${escHtml(name)}</strong></span>
        <span class="badge badge-active">${teamCount} equipos</span>
      </div>
      <p style="color:var(--text2);font-size:14px;margin-top:8px">
        Se generará un bracket de eliminación directa con ${teamCount} equipos. 
        Los enfrentamientos se asignarán de forma aleatoria.
      </p>
      ${teamCount < 2 ? `<p class="text-danger" style="font-size:13px;margin-top:8px">⚠ Se necesitan al menos 2 equipos para iniciar.</p>` : ''}
    </div>
  `;
  document.getElementById('confirmBracketBtn').disabled = teamCount < 2;
  showModal('generateBracketModal');
}

async function confirmGenerateBracket() {
  const id = bracketTournamentId;
  const btn = document.getElementById('confirmBracketBtn');
  btn.disabled = true;
  btn.textContent = 'Generando...';

  try {
    // Get all teams for this tournament
    const { data: teams } = await sb
      .from('teams')
      .select('id, name')
      .eq('tournament_id', id);

    if (!teams || teams.length < 2) {
      showToast('No hay suficientes equipos', 'error');
      btn.disabled = false;
      btn.textContent = 'Generar y Comenzar';
      return;
    }

    // Shuffle teams
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    
    // Generate single-elimination bracket
    const matches = generateBracketMatches(shuffled, id);
    
    // Insert all matches
    const { error: matchError } = await sb.from('matches').insert(matches);
    
    if (matchError) {
      showToast('Error al crear partidas: ' + matchError.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Generar y Comenzar';
      return;
    }

    // Set tournament to active
    await sb.from('tournaments').update({ status: 'active' }).eq('id', id);

    closeModal('generateBracketModal');
    showToast('¡Bracket generado! El torneo ha comenzado.', 'success');
    loadAdminTournaments();

  } catch (err) {
    showToast('Error inesperado: ' + err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Generar y Comenzar';
  }
}

function generateBracketMatches(teams, tournamentId) {
  const matches = [];
  let round = 0;
  let currentTeams = [...teams];
  let matchNumber = 0;

  // Pad to power of 2 with byes (null = bye)
  const targetSize = Math.pow(2, Math.ceil(Math.log2(currentTeams.length)));
  while (currentTeams.length < targetSize) currentTeams.push(null);

  // First round: pair teams
  for (let i = 0; i < currentTeams.length; i += 2) {
    const teamA = currentTeams[i];
    const teamB = currentTeams[i + 1];
    
    if (!teamB) {
      // Bye: team advances automatically — mark as winner already
      matches.push({
        tournament_id: tournamentId,
        round,
        match_number: matchNumber++,
        team_a_id: teamA?.id || null,
        team_b_id: null,
        winner_id: teamA?.id || null,
        score_a: null,
        score_b: null,
        status: 'bye'
      });
    } else {
      matches.push({
        tournament_id: tournamentId,
        round,
        match_number: matchNumber++,
        team_a_id: teamA?.id || null,
        team_b_id: teamB?.id || null,
        winner_id: null,
        score_a: null,
        score_b: null,
        status: 'pending'
      });
    }
  }

  // Create empty slots for subsequent rounds
  let prevRoundMatches = matches.length;
  let nextRoundMatches = Math.ceil(prevRoundMatches / 2);
  round++;

  while (nextRoundMatches >= 1) {
    for (let i = 0; i < nextRoundMatches; i++) {
      matches.push({
        tournament_id: tournamentId,
        round,
        match_number: matchNumber++,
        team_a_id: null,
        team_b_id: null,
        winner_id: null,
        score_a: null,
        score_b: null,
        status: 'waiting'
      });
    }
    if (nextRoundMatches === 1) break;
    prevRoundMatches = nextRoundMatches;
    nextRoundMatches = Math.ceil(prevRoundMatches / 2);
    round++;
  }

  return matches;
}

// ============================================================
// USERS MANAGEMENT
// ============================================================
async function loadUsers() {
  const { data } = await sb
    .from('profiles')
    .select('*')
    .eq('is_admin', false)
    .order('created_at', { ascending: false });

  const tbody = document.getElementById('usersTbody');
  if (!data?.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:2rem">Sin jugadores registrados</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(u => `
    <tr>
      <td><strong>${escHtml(u.nickname)}</strong></td>
      <td style="font-family:monospace;color:var(--neon)">${escHtml(u.brawl_tag)}</td>
      <td>
        ${u.is_verified
          ? '<span class="badge badge-active">✓ Verificado</span>'
          : '<span class="badge badge-pending">⏳ Pendiente</span>'}
      </td>
      <td style="color:var(--text3)">${formatDate(u.created_at)}</td>
      <td>
        ${!u.is_verified ? `
          <button class="btn btn-sm btn-success" onclick="verifyUser('${u.id}')">Verificar</button>
        ` : ''}
        <button class="btn btn-sm btn-ghost" onclick="viewScreenshot('${u.screenshot_path}')">Ver captura</button>
        <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}','${escHtml(u.nickname)}')">Eliminar</button>
      </td>
    </tr>
  `).join('');
}

async function verifyUser(id) {
  const { error } = await sb.from('profiles').update({ is_verified: true }).eq('id', id);
  if (error) { showToast('Error: ' + error.message, 'error'); return; }
  showToast('Usuario verificado', 'success');
  loadUsers();
}

async function deleteUser(id, nick) {
  if (!confirm(`¿Eliminar al usuario "${nick}"? Esta acción no puede deshacerse.`)) return;
  await sb.from('profiles').delete().eq('id', id);
  await sb.auth.admin?.deleteUser(id);
  showToast(`Usuario ${nick} eliminado`, 'success');
  loadUsers();
}

async function viewScreenshot(path) {
  if (!path) { showToast('Sin captura disponible', 'error'); return; }
  const { data } = sb.storage.from('screenshots').getPublicUrl(path);
  window.open(data?.publicUrl || '#', '_blank');
}

// ============================================================
// MATCHES ADMIN
// ============================================================
async function loadAdminMatches() {
  const { data: tournaments } = await sb
    .from('tournaments')
    .select('id, name')
    .eq('status', 'active');

  const el = document.getElementById('adminMatchesContent');

  if (!tournaments?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚔️</div><h3>No hay torneos activos</h3></div>`;
    return;
  }

  const tourney = tournaments[0]; // Show first active tournament

  const { data: matches } = await sb
    .from('matches')
    .select('*, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), winner:teams!matches_winner_id_fkey(name)')
    .eq('tournament_id', tourney.id)
    .order('round').order('match_number');

  if (!matches?.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><h3>Sin partidas generadas</h3></div>`;
    return;
  }

  const rounds = {};
  matches.forEach(m => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });

  el.innerHTML = `
    <div style="margin-bottom:1rem">
      <span class="badge badge-active" style="font-size:13px;padding:6px 14px">${escHtml(tourney.name)}</span>
    </div>
    ${Object.keys(rounds).sort((a,b)=>a-b).map(round => `
      <div class="mb-2">
        <div style="font-family:var(--font-cond);font-size:18px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">
          Ronda ${parseInt(round)+1}
        </div>
        ${rounds[round].map(m => `
          <div class="card mb-1" style="margin-bottom:8px">
            <div class="flex-between">
              <div class="vs-row" style="margin:0;flex:1;gap:8px">
                <div class="team-block" style="text-align:center;flex:1">
                  <div class="team-block-name" style="font-size:16px">${escHtml(m.team_a?.name || 'TBD')}</div>
                  ${m.score_a != null ? `<div style="font-family:var(--font-display);font-size:28px;color:${m.winner_id === m.team_a_id ? 'var(--neon)' : 'var(--text3)'}">${m.score_a}</div>` : ''}
                </div>
                <div class="vs-divider" style="font-size:20px">VS</div>
                <div class="team-block" style="text-align:center;flex:1">
                  <div class="team-block-name" style="font-size:16px">${escHtml(m.team_b?.name || 'TBD')}</div>
                  ${m.score_b != null ? `<div style="font-family:var(--font-display);font-size:28px;color:${m.winner_id === m.team_b_id ? 'var(--neon)' : 'var(--text3)'}">${m.score_b}</div>` : ''}
                </div>
              </div>
              <div style="margin-left:1rem">
                ${m.status === 'pending' ? `
                  <form onsubmit="adminSetResult(event,'${m.id}','${m.team_a_id}','${m.team_b_id}','${tourney.id}')">
                    <div style="display:flex;gap:8px;align-items:center">
                      <input type="number" name="sA" placeholder="0" min="0" max="99" style="width:60px;padding:6px;background:var(--bg-1);border:1px solid var(--border);border-radius:6px;color:var(--text)" required />
                      <span style="color:var(--text3)">—</span>
                      <input type="number" name="sB" placeholder="0" min="0" max="99" style="width:60px;padding:6px;background:var(--bg-1);border:1px solid var(--border);border-radius:6px;color:var(--text)" required />
                      <button type="submit" class="btn btn-sm btn-primary">✓</button>
                    </div>
                  </form>
                ` : m.winner_id ? `<span class="badge badge-active">✓ ${escHtml(m.winner?.name || 'Ganador')}</span>` : `<span class="badge badge-pending">⏳ Esperando</span>`}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;
}

async function adminSetResult(e, matchId, teamAId, teamBId, tournamentId) {
  e.preventDefault();
  const sA = parseInt(e.target.sA.value);
  const sB = parseInt(e.target.sB.value);

  if (sA === sB) { showToast('No puede haber empate', 'error'); return; }

  const winnerId = sA > sB ? teamAId : teamBId;

  const { error } = await sb.from('matches').update({
    score_a: sA,
    score_b: sB,
    winner_id: winnerId,
    status: 'completed'
  }).eq('id', matchId);

  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  // Advance winner to next round
  await advanceWinner(matchId, winnerId, tournamentId);
  showToast('Resultado registrado', 'success');
  loadAdminMatches();
}

async function advanceWinner(matchId, winnerId, tournamentId) {
  // Find the match's round and number
  const { data: match } = await sb.from('matches').select('round, match_number').eq('id', matchId).single();
  if (!match) return;

  const nextRound = match.round + 1;
  const nextMatchIdx = Math.floor(match.match_number / 2);

  // Find the next round match with correct match_number
  const { data: nextMatches } = await sb.from('matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('round', nextRound)
    .order('match_number');

  if (!nextMatches?.length) return; // Tournament might be over

  const nextMatch = nextMatches[nextMatchIdx % nextMatches.length];
  if (!nextMatch) return;

  // Place winner in slot A or B depending on parity
  const isSlotA = match.match_number % 2 === 0;
  await sb.from('matches').update(
    isSlotA ? { team_a_id: winnerId, status: 'pending' } : { team_b_id: winnerId, status: 'pending' }
  ).eq('id', nextMatch.id);
}

// ============================================================
// RESULTS REVIEW
// ============================================================
async function loadResultsReview() {
  const { data } = await sb
    .from('match_results')
    .select('*, matches(round, team_a:teams!matches_team_a_id_fkey(name), team_b:teams!matches_team_b_id_fkey(name), tournament_id), profiles(nickname)')
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  const el = document.getElementById('resultsReviewContent');

  if (!data?.length) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✓</div>
        <h3>Sin resultados pendientes</h3>
        <p>Los resultados enviados por los jugadores aparecerán aquí</p>
      </div>`;
    return;
  }

  el.innerHTML = data.map(r => `
    <div class="result-card mb-2">
      <div style="font-size:12px;color:var(--text3);margin-bottom:8px">
        Ronda ${(r.matches?.round || 0) + 1} — Enviado por <strong>${escHtml(r.profiles?.nickname || '?')}</strong>
      </div>
      <div class="vs-row">
        <div class="team-block">
          <div class="team-block-name">${escHtml(r.matches?.team_a?.name || 'TBD')}</div>
          <div style="font-family:var(--font-display);font-size:40px;color:${r.score_a > r.score_b ? 'var(--neon)' : 'var(--text3)'}">${r.score_a}</div>
        </div>
        <div class="vs-divider">VS</div>
        <div class="team-block">
          <div class="team-block-name">${escHtml(r.matches?.team_b?.name || 'TBD')}</div>
          <div style="font-family:var(--font-display);font-size:40px;color:${r.score_b > r.score_a ? 'var(--neon)' : 'var(--text3)'}">${r.score_b}</div>
        </div>
      </div>
      <div class="flex gap-2 wrap mt-1">
        ${r.screenshot_path ? `
          <button class="btn btn-sm btn-ghost" onclick="viewScreenshot('${r.screenshot_path}')">📸 Ver captura</button>
        ` : ''}
        <button class="btn btn-sm btn-success" onclick="approveResult('${r.id}', '${r.match_id}', ${r.score_a}, ${r.score_b}, '${r.matches?.team_a_id || ''}', '${r.matches?.team_b_id || ''}', '${r.matches?.tournament_id || ''}')">
          ✓ Aprobar
        </button>
        <button class="btn btn-sm btn-danger" onclick="rejectResult('${r.id}')">✕ Rechazar</button>
      </div>
    </div>
  `).join('');
}

async function approveResult(resultId, matchId, scoreA, scoreB, teamAId, teamBId, tournamentId) {
  const winnerId = scoreA > scoreB ? teamAId : teamBId;

  await sb.from('match_results').update({ status: 'approved' }).eq('id', resultId);
  await sb.from('matches').update({
    score_a: scoreA,
    score_b: scoreB,
    winner_id: winnerId,
    status: 'completed'
  }).eq('id', matchId);

  await advanceWinner(matchId, winnerId, tournamentId);
  showToast('Resultado aprobado y bracket actualizado', 'success');
  loadResultsReview();
}

async function rejectResult(resultId) {
  await sb.from('match_results').update({ status: 'rejected' }).eq('id', resultId);
  showToast('Resultado rechazado. El equipo deberá volver a enviarlo.', 'success');
  loadResultsReview();
}

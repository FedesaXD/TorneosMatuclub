// ============================================================
// AUTH MODULE
// Handles registration, login, session management
// ============================================================

// Check if user is already logged in and redirect appropriately
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    const profile = await getProfile(session.user.id);
    if (profile) {
      if (profile.is_admin) {
        window.location.href = 'pages/admin.html';
      } else {
        window.location.href = 'pages/dashboard.html';
      }
    }
  }
}

// Get user profile from our profiles table
async function getProfile(userId) {
  const { data, error } = await sb
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

// Store profile in sessionStorage for quick access
async function loadAndStoreProfile() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = '../index.html';
    return null;
  }
  const profile = await getProfile(session.user.id);
  if (!profile) {
    window.location.href = '../index.html';
    return null;
  }
  sessionStorage.setItem('profile', JSON.stringify(profile));
  return profile;
}

function getStoredProfile() {
  const p = sessionStorage.getItem('profile');
  return p ? JSON.parse(p) : null;
}

// ============================================================
// REGISTER
// ============================================================
async function handleRegister(e) {
  e.preventDefault();
  const nick = document.getElementById('regNick').value.trim();
  const tag = document.getElementById('regTag').value.trim().toUpperCase();
  const pass = document.getElementById('regPass').value;
  const passConfirm = document.getElementById('regPassConfirm').value;
  const file = document.getElementById('regScreenshot').files[0];
  const errEl = document.getElementById('registerError');
  const btn = document.getElementById('registerBtn');

  errEl.classList.add('hidden');

  // Validations
  if (pass !== passConfirm) {
    showFormError(errEl, 'Las contraseñas no coinciden.');
    return;
  }
  if (!file) {
    showFormError(errEl, 'Debes subir una captura de pantalla de tu perfil.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showFormError(errEl, 'La imagen no puede superar los 5MB.');
    return;
  }
  if (!tag.startsWith('#')) {
    showFormError(errEl, 'El tag debe comenzar con #');
    return;
  }

  setLoading(btn, true);

  try {
    // Check if nickname is taken
    const { data: existing } = await sb
      .from('profiles')
      .select('id')
      .eq('nickname', nick)
      .maybeSingle();
    
    if (existing) {
      showFormError(errEl, 'Ese nickname ya está en uso. Elige otro.');
      setLoading(btn, false);
      return;
    }

    // Check if tag is taken
    const { data: existingTag } = await sb
      .from('profiles')
      .select('id')
      .eq('brawl_tag', tag)
      .maybeSingle();
    
    if (existingTag) {
      showFormError(errEl, 'Ese tag de Brawl Stars ya está registrado.');
      setLoading(btn, false);
      return;
    }

    // Create auth user using nickname as email workaround
    const fakeEmail = `${nick.toLowerCase().replace(/[^a-z0-9]/g,'')}@brawlarena.gg`;
    const { data: authData, error: authError } = await sb.auth.signUp({
      email: fakeEmail,
      password: pass,
      options: {
        data: { nickname: nick }
      }
    });

    if (authError) {
      showFormError(errEl, authError.message);
      setLoading(btn, false);
      return;
    }

    const userId = authData.user.id;

    // Upload screenshot
    const ext = file.name.split('.').pop();
    const filePath = `${userId}/profile.${ext}`;
    const { error: uploadError } = await sb.storage
      .from(SCREENSHOT_BUCKET)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      showFormError(errEl, 'Error al subir la imagen: ' + uploadError.message);
      setLoading(btn, false);
      return;
    }

    // Create profile record
    const { error: profileError } = await sb
      .from('profiles')
      .insert({
        id: userId,
        nickname: nick,
        brawl_tag: tag,
        screenshot_path: filePath,
        is_admin: false,
        is_verified: false,
        email: fakeEmail
      });

    if (profileError) {
      showFormError(errEl, 'Error al crear el perfil: ' + profileError.message);
      setLoading(btn, false);
      return;
    }

    closeModal('registerModal');
    showToast('¡Cuenta creada! Puedes iniciar sesión ahora. Un admin verificará tu perfil pronto.', 'success');
    setLoading(btn, false);

  } catch (err) {
    showFormError(errEl, 'Error inesperado: ' + err.message);
    setLoading(btn, false);
  }
}

// ============================================================
// LOGIN
// ============================================================
async function handleLogin(e) {
  e.preventDefault();
  const nick = document.getElementById('loginNick').value.trim();
  const pass = document.getElementById('loginPass').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  errEl.classList.add('hidden');
  setLoading(btn, true);

  try {
    // Find user by nickname
    const { data: profile } = await sb
      .from('profiles')
      .select('email, is_admin')
      .eq('nickname', nick)
      .maybeSingle();

    if (!profile) {
      showFormError(errEl, 'Nickname no encontrado.');
      setLoading(btn, false);
      return;
    }

    const { data: authData, error: authError } = await sb.auth.signInWithPassword({
      email: profile.email,
      password: pass
    });

    if (authError) {
      showFormError(errEl, 'Contraseña incorrecta.');
      setLoading(btn, false);
      return;
    }

    setLoading(btn, false);
    
    if (profile.is_admin) {
      window.location.href = 'pages/admin.html';
    } else {
      window.location.href = 'pages/dashboard.html';
    }

  } catch (err) {
    showFormError(errEl, 'Error inesperado: ' + err.message);
    setLoading(btn, false);
  }
}

// ============================================================
// LOGOUT
// ============================================================
async function handleLogout() {
  await sb.auth.signOut();
  sessionStorage.removeItem('profile');
  window.location.href = '../index.html';
}

// ============================================================
// AUTH GUARD (use in dashboard/admin pages)
// ============================================================
async function requireAuth(adminRequired = false) {
  const profile = await loadAndStoreProfile();
  if (!profile) return null;
  
  if (adminRequired && !profile.is_admin) {
    window.location.href = 'dashboard.html';
    return null;
  }
  
  if (!adminRequired && profile.is_admin) {
    window.location.href = 'admin.html';
    return null;
  }
  
  return profile;
}

// ============================================================
// STATS for landing page
// ============================================================
async function loadStats() {
  try {
    const [{ count: players }, { count: tournaments }, { count: teams }] = await Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('tournaments').select('*', { count: 'exact', head: true }),
      sb.from('teams').select('*', { count: 'exact', head: true })
    ]);
    
    if (document.getElementById('statPlayers')) {
      animateCount('statPlayers', players || 0);
      animateCount('statTourneys', tournaments || 0);
      animateCount('statTeams', teams || 0);
    }
  } catch (e) {
    // If Supabase not configured yet, show dashes
  }
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step = Math.ceil(target / 30);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

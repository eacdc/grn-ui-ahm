(function() {
  'use strict';

  const YEAR_EL = document.getElementById('year');
  if (YEAR_EL) YEAR_EL.textContent = String(new Date().getFullYear());

  // Config
  const DEFAULT_API_BASE = 'https://cdcapi.onrender.com/api/';
  const LOCAL_API_BASE = 'http://localhost:3001/api/';
  const FIXED_DATABASE = 'AHM'; // AHM database fixed

  function isValidAbsoluteUrl(value) {
    if (!value || typeof value !== 'string') return false;
    const v = value.trim();
    if (!(v.startsWith('http://') || v.startsWith('https://'))) return false;
    try { new URL(v); return true; } catch (_) { return false; }
  }

  function getApiBaseUrl() {
    try {
      const stored = localStorage.getItem('grn_api_base');
      const chosen = isValidAbsoluteUrl(stored) ? stored : DEFAULT_API_BASE;
      return chosen.endsWith('/') ? chosen : chosen + '/';
    } catch (_) {
      return DEFAULT_API_BASE;
    }
  }

  // Siren sound for error/fail notifications (works after any user interaction)
  function playSiren() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!window.__grnAudioCtx) {
        window.__grnAudioCtx = new AudioCtx();
      }
      const ctx = window.__grnAudioCtx;
      // Some mobile browsers require resume after gesture
      if (ctx.state === 'suspended') { ctx.resume().catch(() => {}); }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);

      // Sweep frequency up and down quickly to mimic a siren
      const start = ctx.currentTime;
      osc.frequency.setValueAtTime(600, start);
      osc.frequency.linearRampToValueAtTime(1200, start + 0.3);
      osc.frequency.linearRampToValueAtTime(700, start + 0.6);
      osc.frequency.linearRampToValueAtTime(1100, start + 0.9);

      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      // Fade out and stop
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.1);
      osc.stop(start + 1.2);
    } catch (_) {
      // Ignore audio errors
    }
  }

  function alertWithSiren(message) {
    try { playSiren(); } catch (_) {}
    alert(message);
  }

  // Elements
  const loginSection = document.getElementById('login-section');
  const postLoginSection = document.getElementById('post-login-section');
  const challanFormSection = document.getElementById('challan-form-section');
  const deliveryNoteConfirmation = document.getElementById('delivery-note-confirmation');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const usernameInput = document.getElementById('username');
  const infoUsername = document.getElementById('info-username');
  const infoDatabase = document.getElementById('info-database');
  const barcodeInput = document.getElementById('barcode');
  const initiateBtn = document.getElementById('btn-initiate');
  const logoutBtn = document.getElementById('btn-logout');
  const clientNameInput = document.getElementById('clientName');
  const modeOfTransportSelect = document.getElementById('modeOfTransport');
  const containerNumberInput = document.getElementById('containerNumber');
  const sealNumberInput = document.getElementById('sealNumber');
  const transporterNameSelect = document.getElementById('transporterName');
  const vehicleNumberInput = document.getElementById('vehicleNumber');
  const saveChallanBtn = document.getElementById('btn-save-challan');
  const dnNumberSpan = document.getElementById('dn-number');
  const confClientName = document.getElementById('conf-client-name');
  const confModeTransport = document.getElementById('conf-mode-transport');
  const confTransporter = document.getElementById('conf-transporter');
  const confContainer = document.getElementById('conf-container');
  const confVehicle = document.getElementById('conf-vehicle');
  const confSeal = document.getElementById('conf-seal');
  const confBarcode = document.getElementById('conf-barcode');
  const updateDeliveryNoteBtn = document.getElementById('btn-update-delivery-note');
  const deliveryTableBody = document.getElementById('delivery-table-body');
  const backToInitiateBtn = document.getElementById('btn-back-to-initiate');
  const backToFormBtn = document.getElementById('btn-back-to-form');

  let session = null; // { userId, ledgerId, machines, selectedDatabase, username }

  function showError(msg, isInfo = false) {
    if (loginError) {
      loginError.textContent = msg || '';
      if (isInfo) {
        loginError.classList.add('info');
      } else {
        loginError.classList.remove('info');
      }
    }
  }

  // Load transporter options from backend
  async function loadTransporters() {
    try {
      if (!session || !session.selectedDatabase) return;
      if (transporterNameSelect) {
        transporterNameSelect.innerHTML = '<option value="">Loading...</option>';
      }
      const base = getApiBaseUrl();
      const url = new URL('grn/transporters', base);
      url.searchParams.set('database', session.selectedDatabase);
      const res = await fetch(url.toString(), { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
      if (!res.ok) {
        if (transporterNameSelect) transporterNameSelect.innerHTML = '<option value="">Select Transporter</option>';
        return;
      }
      const data = await res.json();
      if (!data || data.status !== true || !Array.isArray(data.transporters)) {
        if (transporterNameSelect) transporterNameSelect.innerHTML = '<option value="">Select Transporter</option>';
        return;
      }
      if (transporterNameSelect) {
        transporterNameSelect.innerHTML = '<option value="">Select Transporter</option>' + data.transporters.map(t => `<option value="${t.ledgerName}">${t.ledgerName}</option>`).join('');
      }
    } catch (_) {
      if (transporterNameSelect) transporterNameSelect.innerHTML = '<option value="">Select Transporter</option>';
    }
  }

  async function clearDbCache() {
    try {
      const base = getApiBaseUrl();
      const clearUrl = new URL('admin/clear-db-cache', base);
      await fetch(clearUrl.toString(), {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        credentials: 'include'
      });
    } catch (e) {
      console.warn('Failed to clear DB cache:', e);
    }
  }

  async function login(username) {
    const base = getApiBaseUrl();
    const url = new URL('auth/login', base);
    const safeUsername = String(username || '').trim();
    url.searchParams.set('username', safeUsername);
    url.searchParams.set('database', FIXED_DATABASE); // Always use AHM
    url.searchParams.set('_t', Date.now().toString());

    console.log('Making login request to:', url.toString());
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      credentials: 'include',
      cache: 'no-store'
    });
    console.log('Login response status:', res.status);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Request failed (${res.status}) URL: ${url.toString()}`);
    }
    const data = await res.json();
    console.log('Login response data:', data);
    if (!data || data.status !== true) {
      console.log('Login failed - data.status:', data?.status, 'data.error:', data?.error);
      throw new Error((data && data.error ? data.error : 'Login failed') + ` | URL: ${url.toString()}`);
    }
    console.log('Login successful, switching to post-login screen');
    return data;
  }

  function swapToPostLogin(data, username) {
    session = {
      userId: data.userId,
      ledgerId: data.ledgerId,
      machines: data.machines || [],
      selectedDatabase: FIXED_DATABASE, // Always AHM
      username: username
    };

    // Session stored in memory only - no persistence to avoid DB conflicts

    if (infoUsername) infoUsername.textContent = username;
    if (infoDatabase) infoDatabase.textContent = FIXED_DATABASE;

    if (loginSection) loginSection.classList.add('hidden');
    if (postLoginSection) postLoginSection.classList.remove('hidden');
    if (barcodeInput) barcodeInput.focus();
    if (logoutBtn) logoutBtn.classList.remove('hidden');
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showError('');
      const username = String(usernameInput.value || '').trim();
      if (!username) {
        showError('Please enter username.');
        return;
      }
      
      // Show loading message (in cyan color, not red)
      showError('Logging in, please wait...', true);
      
      // Disable submit button during delay
      const submitBtn = loginForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      
      try {
        // Wait for 3 seconds before sending credentials
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const data = await login(username);
        swapToPostLogin(data, username);
      } catch (err) {
        showError(err.message || 'Login failed');
      } finally {
        // Re-enable submit button
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  if (initiateBtn) {
    initiateBtn.addEventListener('click', async () => {
      const barcode = String(barcodeInput.value || '').trim();
      if (!barcode) {
        alert('Please enter a Barcode Number.');
        barcodeInput.focus();
        return;
      }
      if (!session || !session.selectedDatabase) {
        alert('Please login first.');
        return;
      }
      try {
        // Call backend to initiate challan
        const base = getApiBaseUrl();
        const url = new URL('grn/initiate', base);
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            barcode: Number(barcode),
            database: session.selectedDatabase,
            userId: session.userId
          })
        });
        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || 'Failed to initiate challan');
        }
        const data = await res.json();
        if (!data || data.status !== true) {
          alertWithSiren(data?.error || 'Failed to initiate challan');
          return;
        }
        // Fill challan form
        if (clientNameInput) clientNameInput.value = data.ledgerName || '';
        // Store barcode in session for later use
        session.challanBarcode = Number(barcode);
        
        // Navigate to challan form view
        if (postLoginSection) postLoginSection.classList.add('hidden');
        if (challanFormSection) challanFormSection.classList.remove('hidden');
        await loadTransporters();
      } catch (e) {
        try {
          const parsed = JSON.parse(e.message);
          alertWithSiren(parsed.error || 'Failed to initiate challan');
        } catch(_) {
          alertWithSiren(String(e.message || e));
        }
      }
    });
  }

  // Save delivery note
  if (saveChallanBtn) {
    saveChallanBtn.addEventListener('click', async () => {
      if (!session || !session.selectedDatabase) {
        alert('Please login first.');
        return;
      }

      const clientName = String(clientNameInput?.value || '').trim();
      const modeOfTransport = String(modeOfTransportSelect?.value || '').trim();
      const containerNumber = String(containerNumberInput?.value || '').trim();
      const sealNumber = String(sealNumberInput?.value || '').trim();
      const transporterName = String(transporterNameSelect?.value || '').trim();
      const vehicleNumber = String(vehicleNumberInput?.value || '').trim();
      // Find ledgerId for selected transporter name from current dropdown options using dataset if available later
      let transporterLedgerId = null;
      try {
        // Attempt to fetch ledgerId list fresh to resolve selected name
        const base = getApiBaseUrl();
        const urlT = new URL('grn/transporters', base);
        urlT.searchParams.set('database', session.selectedDatabase);
        const resT = await fetch(urlT.toString(), { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
        const dataT = await resT.json();
        if (dataT && dataT.status === true && Array.isArray(dataT.transporters)) {
          const match = dataT.transporters.find(t => String(t.ledgerName).trim() === transporterName);
          transporterLedgerId = match ? match.ledgerId : null;
        }
      } catch (_) {}

      if (!transporterLedgerId) {
        alert('Could not resolve selected transporter. Please re-select transporter.');
        return;
      }

      // Validate required fields
      if (!clientName || !modeOfTransport || !containerNumber || !sealNumber || !transporterName || !vehicleNumber) {
        alert('All fields are mandatory. Please fill in all required information.');
        return;
      }

      try {
        const base = getApiBaseUrl();
        const url = new URL('grn/save-delivery-note', base);
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            barcode: session.challanBarcode,
            database: session.selectedDatabase,
            userId: session.userId,
            clientName,
            modeOfTransport,
            containerNumber,
            sealNumber,
            transporterName,
            transporterLedgerId,
            vehicleNumber
          })
        });

        if (!res.ok) {
          const t = await res.text().catch(() => '');
          throw new Error(t || 'Failed to save delivery note');
        }

        const data = await res.json();
        if (!data || data.status !== true) {
          // Show specific message if provided by backend
          alertWithSiren(data?.error || 'Failed to save delivery note');
          return;
        }

        // Show confirmation page
        if (dnNumberSpan) dnNumberSpan.textContent = data.deliveryNoteNumber;
        if (confClientName) confClientName.value = data.data.clientName;
        if (confModeTransport) confModeTransport.value = data.data.modeOfTransport;
        if (confTransporter) confTransporter.value = data.data.transporterName;
        if (confContainer) confContainer.value = data.data.containerNumber;
        if (confVehicle) confVehicle.value = data.data.vehicleNumber;
        if (confSeal) confSeal.value = data.data.sealNumber;
        // Don't prefill barcode - leave it empty for user input

        if (challanFormSection) challanFormSection.classList.add('hidden');
        if (deliveryNoteConfirmation) deliveryNoteConfirmation.classList.remove('hidden');

        // Add first row to table from SP output and form values
        if (deliveryTableBody) {
          const sp = data.sp || {};
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${data?.data?.barcode ?? session?.challanBarcode ?? ''}</td>
            <td>${sp.jobName ?? '—'}</td>
            <td>${sp.orderQty ?? '—'}</td>
            <td>${sp.gpnQty ?? '—'}</td>
            <td>${sp.deliveredThisVoucher ?? '—'}</td>
            <td>${sp.deliveredTotal ?? '—'}</td>
            <td>${sp.cartonCount ?? '—'}</td>
          `;
          deliveryTableBody.innerHTML = '';
          deliveryTableBody.appendChild(row);
          // Remember FGTransactionID for updates
          if (sp && sp.transactionId) {
            window.__lastFgTransactionId = sp.transactionId;
          }
        }
      } catch (e) {
        alertWithSiren(String(e.message || e));
      }
    });
  }

  // Update delivery note
  async function runUpdateDeliveryNote() {
    try {
          if (!session || !session.selectedDatabase || !session.userId) {
            alert('Please login first.');
            return;
          }
          const barcodeVal = String(confBarcode?.value || '').trim();
          if (!barcodeVal) { alert('Enter barcode number'); if (confBarcode) confBarcode.focus(); return; }

          // Use last FGTransactionID if available from the previous save
          const fgId = window.__lastFgTransactionId;
          if (!fgId) { alert('Missing FGTransactionID from initial save. Please save the delivery note first.'); return; }

          const base = getApiBaseUrl();
          const url = new URL('grn/update-delivery-note', base);
          const res = await fetch(url.toString(), {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              barcode: Number(barcodeVal),
              database: session.selectedDatabase,
              userId: session.userId,
              fgTransactionId: fgId
            })
          });
          if (!res.ok) {
            const t = await res.text().catch(() => '');
            throw new Error(t || 'Failed to update delivery note');
          }
          const data = await res.json();
          if (!data || data.status !== true) { alertWithSiren(data?.error || 'Failed to update delivery note'); return; }
          const sp = data.sp || {};

          if (deliveryTableBody) {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
              <td>${barcodeVal}</td>
              <td>${sp.jobName ?? '—'}</td>
              <td>${sp.orderQty ?? '—'}</td>
              <td>${sp.gpnQty ?? '—'}</td>
            <td>${sp.deliveredThisVoucher ?? '—'}</td>
              <td>${sp.deliveredTotal ?? '—'}</td>
              <td>${sp.cartonCount ?? '—'}</td>
            `;
            deliveryTableBody.insertBefore(newRow, deliveryTableBody.firstChild);
          }

          if (confBarcode) confBarcode.value = '';
          if (confBarcode) confBarcode.focus();
    } catch (e) {
      alertWithSiren(String(e.message || e));
    }
  }

  if (updateDeliveryNoteBtn) {
    updateDeliveryNoteBtn.addEventListener('click', () => { runUpdateDeliveryNote(); });
  }

  if (confBarcode) {
    confBarcode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        runUpdateDeliveryNote();
      }
    });
  }

  // Initialize table with 10 empty rows
  function initializeTable() {
    if (deliveryTableBody) {
      deliveryTableBody.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
          <td></td>
        `;
        deliveryTableBody.appendChild(row);
      }
    }
  }

  // Initialize table on page load
  initializeTable();

  // Back button handlers
  if (backToInitiateBtn) {
    backToInitiateBtn.addEventListener('click', () => {
      if (challanFormSection) challanFormSection.classList.add('hidden');
      if (postLoginSection) postLoginSection.classList.remove('hidden');
    });
  }

  if (backToFormBtn) {
    backToFormBtn.addEventListener('click', () => {
      if (deliveryNoteConfirmation) deliveryNoteConfirmation.classList.add('hidden');
      if (challanFormSection) challanFormSection.classList.remove('hidden');
    });
  }

  // No session restoration - user must login on each page load
  // This prevents any database selection conflicts

  // Logout - Clear in-memory session only
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      // Clear in-memory session
      session = null;
      
      // Reset UI to login screen
      if (postLoginSection) postLoginSection.classList.add('hidden');
      if (challanFormSection) challanFormSection.classList.add('hidden');
      if (deliveryNoteConfirmation) deliveryNoteConfirmation.classList.add('hidden');
      if (loginSection) loginSection.classList.remove('hidden');
      if (logoutBtn) logoutBtn.classList.add('hidden');
      if (usernameInput) usernameInput.focus();
    });
  }

  // Optional: expose a quick toggle to local API for dev via console
  window.GRN_API = {
    get base() { return getApiBaseUrl(); },
    setBase(url) { try { localStorage.setItem('grn_api_base', url); } catch(_) {} },
    useLocal() { try { localStorage.setItem('grn_api_base', LOCAL_API_BASE); } catch(_) {} },
    useProd() { try { localStorage.setItem('grn_api_base', DEFAULT_API_BASE); } catch(_) {} },
  };
})();



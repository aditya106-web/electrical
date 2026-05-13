// Firebase Configuration - REPLACE WITH YOUR ACTUAL CONFIG
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};

const appId = 'ebol-pwa-v6';
const PATH_FOLDERS = ['artifacts', appId, 'public', 'data', 'folders'];
const PATH_ITEMS = ['artifacts', appId, 'public', 'data', 'items'];

// Initialize Firebase
let db;
try {
  firebase.initializeApp(firebaseConfig);
  db = firebase.firestore();
} catch (error) {
  console.error("Firebase initialization failed:", error);
}

// Simple state management
class AppState {
  constructor() {
    this.state = {
      user: null,
      configError: !db,
      isLoggedIn: false,
      activeNIK: '',
      loginData: { id: '', password: '' },
      loading: true,
      items: [],
      folders: [],
      currentFolderId: null,
      searchTerm: '',
      filterPlane: 'Semua',
      isModalOpen: false,
      isFolderModalOpen: false,
      newFolderName: '',
      submitting: false,
      previewImage: null,
      notification: null,
      editingItem: null,
      confirmDelete: null,
      newItem: { 
        name: '', frame: '', stranger: '', status: 'Pending', 
        plane: 'NC212', category: 'Electric', drawingRef: '', 
        image: null, folderId: '' 
      }
    };
    this.listeners = [];
    this.fileInputRef = null;
    this.masterUsers = { '260217': '260217', '170025': '170025', '120154': '120154' };
  }

  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.render();
  }

  showNotify(msg, type = 'success') {
    this.setState({ notification: { msg, type } });
    setTimeout(() => this.setState({ notification: null }), 3000);
  }

  async initAuth() {
    try {
      await firebase.auth().signInAnonymously();
    } catch (err) {
      console.error("Auth Error:", err);
    }
  }

  setupListeners() {
    if (!db || !this.state.isLoggedIn) return;

    const unsubscribeFolders = db.collection(...PATH_FOLDERS)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.setState({ folders: data });
      });

    const unsubscribeItems = db.collection(...PATH_ITEMS)
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        this.setState({ items: data });
      });

    this.listeners.push(unsubscribeFolders, unsubscribeItems);
  }

  handleLogin(e) {
    e.preventDefault();
    if (this.masterUsers[this.state.loginData.id] === this.state.loginData.password) {
      this.setState({ activeNIK: this.state.loginData.id, isLoggedIn: true });
      this.setupListeners();
    } else {
      this.showNotify("NIK atau Akses Salah", "error");
    }
  }

  processImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const newItem = { ...this.state.newItem, image: canvas.toDataURL('image/jpeg', 0.6) };
        this.setState({ newItem });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }

  async handleSaveItem(e) {
    e.preventDefault();
    this.setState({ submitting: true });
    try {
      const itemData = {
        ...this.state.newItem,
        folderId: this.state.currentFolderId || this.state.newItem.folderId || '',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        inputByNIK: this.state.activeNIK
      };

      if (this.state.editingItem) {
        await db.collection(...PATH_ITEMS).doc(this.state.editingItem.id).update(itemData);
        this.showNotify("Data Diperbarui");
      } else {
        await db.collection(...PATH_ITEMS).add({ 
          ...itemData, 
          createdAt: firebase.firestore.FieldValue.serverTimestamp(), 
          status: 'Pending' 
        });
        this.showNotify("Data Disimpan");
      }
      this.setState({ 
        isModalOpen: false,
        editingItem: null,
        newItem: { name: '', frame: '', stranger: '', status: 'Pending', plane: 'NC212', category: 'Electric', drawingRef: '', image: null, folderId: '' }
      });
    } catch (err) {
      this.showNotify("Gagal menyimpan data", "error");
    } finally {
      this.setState({ submitting: false });
    }
  }

  handleEdit(item) {
    const newItem = {
      name: item.name || '',
      frame: item.frame || '',
      stranger: item.stranger || '',
      status: item.status || 'Pending',
      plane: item.plane || 'NC212',
      category: item.category || 'Electric',
      drawingRef: item.drawingRef || '',
      image: item.image || null,
      folderId: item.folderId || ''
    };
    this.setState({ editingItem: item, newItem, isModalOpen: true });
  }

  async handleAddFolder(e) {
    e.preventDefault();
    if (!this.state.newFolderName.trim()) return;
    this.setState({ submitting: true });
    try {
      await db.collection(...PATH_FOLDERS).add({ 
        name: this.state.newFolderName.toUpperCase(), 
        createdAt: firebase.firestore.FieldValue.serverTimestamp() 
      });
      this.setState({ newFolderName: '', isFolderModalOpen: false });
      this.showNotify("Folder Berhasil Dibuat");
    } catch (err) {
      this.showNotify("Gagal membuat folder", "error");
    } finally {
      this.setState({ submitting: false });
    }
  }

  async handleDeleteFolder(id) {
    this.setState({ submitting: true });
    try {
      await db.collection(...PATH_FOLDERS).doc(id).delete();
      this.setState({ currentFolderId: null });
      this.showNotify("Folder Dihapus");
    } catch (err) {
      this.showNotify("Gagal menghapus folder", "error");
    } finally {
      this.setState({ submitting: false });
    }
  }

  async toggleStatus(id, currentStatus) {
    try {
      const nextStatus = currentStatus === 'Pending' ? 'Terpasang' : 'Pending';
      await db.collection(...PATH_ITEMS).doc(id).update({ status: nextStatus });
    } catch (err) {
      this.showNotify("Gagal update status", "error");
    }
  }

  async executeDelete() {
    if (!this.state.confirmDelete) return;
    if (this.state.confirmDelete.type === 'item') {
      try {
        await db.collection(...PATH_ITEMS).doc(this.state.confirmDelete.id).delete();
        this.showNotify("Data Dihapus");
      } catch (err) {
        this.showNotify("Gagal menghapus", "error");
      }
    } else {
      await this.handleDeleteFolder(this.state.confirmDelete.id);
    }
    this.setState({ confirmDelete: null });
  }

  getFilteredItems() {
    return this.state.items.filter(i => {
      const matchSearch = (i.name + i.frame + (i.drawingRef || '') + (i.stranger || '')).toLowerCase().includes(this.state.searchTerm.toLowerCase());
      const matchPlane = this.state.filterPlane === 'Semua' || i.plane === this.state.filterPlane;
      const matchFolder = this.state.currentFolderId ? i.folderId === this.state.currentFolderId : true;
      return matchSearch && matchPlane && matchFolder;
    });
  }

  getStats() {
    const items = this.state.items;
    return {
      total: items.length,
      done: items.filter(i => i.status === 'Terpasang').length,
      pending: items.filter(i => i.status === 'Pending').length
    };
  }

  render() {
    const root = document.getElementById('root');
    if (!root) return;
    root.innerHTML = this.getHTML();
    this.initIcons();
    this.attachEventListeners();
  }

  initIcons() {
    lucide.createIcons();
  }

  attachEventListeners() {
    // Re-attach any dynamic event listeners if needed
  }

  getHTML() {
    const state = this.state;
    const filteredItems = this.getFilteredItems();
    const stats = this.getStats();
    const currentFolder = state.folders.find(f => f.id === state.currentFolderId);

    if (state.configError) {
      return `
        <div class="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-center">
          <div class="max-w-md bg-[#0f172a] p-8 rounded-[3rem] border border-rose-500/30 shadow-2xl">
            <i data-lucide="AlertCircle" class="text-rose-500 mx-auto mb-4 w-12 h-12"></i>
            <h2 class="text-xl font-black text-white uppercase mb-2">Configuration Missing</h2>
            <p class="text-slate-400 text-sm">Aplikasi ini membutuhkan konfigurasi Firebase untuk berjalan. Silakan hubungi Administrator Sistem.</p>
          </div>
        </div>
      `;
    }

    if (state.loading) {
      return `
        <div class="min-h-screen bg-[#020617] flex flex-col items-center justify-center">
          <div class="w-12 h-12 border-4 border-yellow-500/20 border-t-yellow-500 rounded-full animate-spin"></div>
          <p class="mt-4 text-slate-500 font-black uppercase text-[10px] tracking-widest">Initialising Core Modules...</p>
        </div>
      `;
    }

    if (!state.isLoggedIn) {
      return `
        <div class="min-h-screen bg-[#020617] flex items-center justify-center p-6 font-sans">
          <div class="w-full max-w-sm">
            <div class="text-center mb-10">
              <div class="relative inline-block p-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-[2.5rem] shadow-2xl mb-8">
                <i data-lucide="Zap" class="w-12 h-12 text-white"></i>
                <div class="absolute -bottom-2 -right-2 bg-slate-950 p-2 rounded-xl border border-yellow-500/50">
                  <i data-lucide="ShieldCheck" class="w-4 h-4 text-yellow-500"></i>
                </div>
              </div>
              <h1 class="text-7xl font-black text-white italic tracking-tighter leading-none">EBOL</h1>
              <p class="text-[10px] text-slate-500 font-black uppercase tracking-[0.5em] mt-3">Electric Basic Layout</p>
            </div>
            <form class="bg-[#0f172a]/80 backdrop-blur-xl p-8 rounded-[3rem] border border-slate-800 shadow-2xl space-y-5 login-form">
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-500 uppercase ml-4 block">Personnel ID (NIK)</label>
                <input type="text" required class="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white font-bold focus:ring-2 focus:ring-yellow-500 outline-none transition-all" value="${state.loginData.id}" data-field="login-id" placeholder="2XXXXX" />
              </div>
              <div class="space-y-2">
                <label class="text-[10px] font-black text-slate-500 uppercase ml-4 block">Access Code</label>
                <input type="password" required class="w-full bg-slate-950 border border-slate-800 rounded-2xl py-4 px-6 text-white font-bold focus:ring-2 focus:ring-yellow-500 outline-none transition-all" value="${state.loginData.password}" data-field="login-password" placeholder="••••" />
              </div>
              <button class="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-slate-950 py-5 rounded-2xl font-black uppercase tracking-widest hover:brightness-110 active:scale-[0.98] transition-all shadow-xl shadow-yellow-500/10 login-submit">Authorize Access</button>
            </form>
            <div class="text-center mt-8 space-y-2">
              <p class="text-[9px] text-slate-600 font-bold uppercase tracking-widest italic">Aeronautical Maintenance System v6.2</p>
              <p class="text-[10px] text-yellow-500/50 font-black uppercase tracking-[0.2em]">PT DIRGANTARA INDONESIA • PRODUCTION DIVISION</p>
            </div>
          </div>
        </div>
      `;
    }

    // Main app HTML (abbreviated for brevity - full implementation would continue here)
    let html = `
      <div class="min-h-screen bg-[#020617] text-slate-100 pb-24 font-sans selection:bg-yellow-500/30">
        ${state.notification ? `
          <div class="fixed top-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-wider flex items-center gap-3 shadow-2xl animate-in slide-in-from-top duration-300 ${state.notification.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'}">
            ${state.notification.msg}
          </div>
        ` : ''}
        
        <!-- Navbar -->
        <nav class="sticky top-0 z-50
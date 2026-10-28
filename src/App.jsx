
import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import ProductManager from "./ProductManager";
import "./App.css";

const products = [
  { name: "Flower Pots", category: "Ground Fireworks", icon: "🎆", desc: "A classic fountain-style fireworks display." },
  { name: "Sparklers", category: "Handheld Fireworks", icon: "✨", desc: "A familiar part of festive celebrations." },
  { name: "Sky Displays", category: "Aerial Fireworks", icon: "🌠", desc: "Colourful effects lighting up the night sky." },
  { name: "Colour Fountains", category: "Ground Fireworks", icon: "🌟", desc: "Explore bright, fountain-style visual displays." },
  { name: "Chakkars", category: "Ground Fireworks", icon: "🌀", desc: "A traditional category in fireworks catalogues." },
  { name: "Crackers", category: "Firecrackers", icon: "🎇", desc: "Browse this traditional fireworks category." },
];

const categories = ["All", "Ground Fireworks", "Handheld Fireworks", "Aerial Fireworks", "Firecrackers"];

function Announcements() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("announcements")
        .select("id, title, message, created_at")
        .eq("published", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Announcement loading failed:", error.message);
        return;
      }
      setItems(data || []);
    }

    load();

    const channel = supabase
      .channel("live-announcements")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, load)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (!items.length) return null;

  return (
    <section className="announcements">
      <span className="eyebrow">LATEST UPDATES</span>
      {items.map(item => (
        <article key={item.id}>
          <h3>{item.title}</h3>
          <p>{item.message}</p>
        </article>
      ))}
    </section>
  );
}

function AdminPanel() {
  const [session, setSession] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [published, setPublished] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState("");

  async function checkAdmin(user) {
    const { data, error } = await supabase
      .from("announcement_admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      setAuthorized(false);
      setNotice("This account is not an authorized admin.");
      return false;
    }

    setAuthorized(true);
    return true;
  }

  async function loadItems() {
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, message, published, created_at")
      .order("created_at", { ascending: false });

    if (error) setNotice("Could not load announcements: " + error.message);
    else setItems(data || []);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      if (data.session) {
        setSession(data.session);
        if (await checkAdmin(data.session.user)) {
          if (active) await loadItems();
        }
      }
      if (active) setLoading(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        if (!newSession) {
          setAuthorized(false);
          setItems([]);
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function login(event) {
    event.preventDefault();
    setNotice("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setNotice("Login failed. Check your email and password.");
      return;
    }

    setSession(data.session);

    if (await checkAdmin(data.user)) {
      await loadItems();
      setNotice("Welcome to the admin panel.");
    } else {
      await supabase.auth.signOut();
      setSession(null);
    }
  }

  function resetForm() {
    setTitle("");
    setMessage("");
    setPublished(true);
    setEditingId(null);
  }

  async function saveAnnouncement(event) {
    event.preventDefault();
    setNotice("");

    const values = { title: title.trim(), message: message.trim(), published };

    if (!values.title || !values.message) {
      setNotice("Please enter both a title and a message.");
      return;
    }

    const result = editingId
      ? await supabase.from("announcements").update(values).eq("id", editingId)
      : await supabase.from("announcements").insert([values]);

    if (result.error) {
      setNotice("Save failed: " + result.error.message);
      return;
    }

    resetForm();
    await loadItems();
    setNotice("Announcement saved successfully.");
  }

  async function deleteAnnouncement(id) {
    if (!window.confirm("Delete this announcement permanently?")) return;

    const { error } = await supabase.from("announcements").delete().eq("id", id);

    if (error) {
      setNotice("Delete failed: " + error.message);
      return;
    }

    await loadItems();
    setNotice("Announcement deleted.");
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setAuthorized(false);
    setItems([]);
    resetForm();
    setNotice("You have signed out.");
  }

  if (loading) return <main className="admin-page"><p>Loading admin panel...</p></main>;

  if (!session || !authorized) {
    return (
      <main className="admin-page">
        <form className="admin-card" onSubmit={login}>
          <a className="brand" href="/">BHUTANI FIREWORKS</a>
          <span className="eyebrow">SECURE ACCESS</span>
          <h1>Admin Login</h1>
          <p>Sign in to manage website announcements.</p>
          <label>Email address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
          <label>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          <button className="admin-primary" type="submit">Sign In</button>
          {notice && <p className="admin-notice">{notice}</p>}
          <a href="/">← Back to website</a>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-dashboard">
        <header className="admin-header">
          <div>
            <span className="eyebrow">BHUTANI FIREWORKS</span>
            <h1>Announcements</h1>
            <p>Publish and manage your website updates.</p>
          </div>
          <button type="button" className="admin-secondary" onClick={logout}>Sign Out</button>
        </header>

        <form className="admin-card" onSubmit={saveAnnouncement}>
          <h2>{editingId ? "Edit announcement" : "Create announcement"}</h2>
          <label>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} required />
          <label>Message</label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={2000} required />
          <label className="admin-checkbox">
            <input type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
            Publish on public website
          </label>
          <div className="admin-actions">
            <button className="admin-primary" type="submit">{editingId ? "Save Changes" : "Create Announcement"}</button>
            {editingId && <button className="admin-secondary" type="button" onClick={resetForm}>Cancel</button>}
          </div>
          {notice && <p className="admin-notice">{notice}</p>}
        </form>

        <ProductManager />

        <section className="admin-list">
          <h2>All announcements ({items.length})</h2>
          {items.map(item => (
            <article className="admin-item" key={item.id}>
              <div>
                <span className={item.published ? "admin-status live" : "admin-status"}>
                  {item.published ? "PUBLISHED" : "DRAFT"}
                </span>
                <h3>{item.title}</h3>
                <p>{item.message}</p>
              </div>
              <div className="admin-actions">
                <button className="admin-secondary" type="button" onClick={() => {
                  setEditingId(item.id);
                  setTitle(item.title);
                  setMessage(item.message);
                  setPublished(item.published);
                  setNotice("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}>Edit</button>
                <button className="admin-danger" type="button" onClick={() => deleteAnnouncement(item.id)}>Delete</button>
              </div>
            </article>
          ))}
          {!items.length && <p>No announcements yet.</p>}
        </section>
        <a href="/">← View public website</a>
      </div>
    </main>
  );
}

function FloatingContacts() {
  return (
    <div className="floating-contacts" aria-label="Contact Bhutani Fireworks">
      <a className="floating-contact main-contact" href="tel:+918588982024" aria-label="Call main contact">
        <span className="contact-icon">☎</span>
        <span className="contact-label">Call Us</span>
        <span className="contact-number">8588982024</span>
      </a>
      <a className="floating-contact extra-contact" href="tel:+919599752314" aria-label="Call additional contact">
        <span className="contact-icon">✆</span>
        <span className="contact-label">Additional Contact</span>
        <span className="contact-number">9599752314</span>
      </a>
    </div>
  );
}

function App() {
  const [catalogueProducts, setCatalogueProducts] = useState(products);

  useEffect(() => {
    let active = true;

    async function loadCatalogue() {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, price, category, image_url, description, available")
        // Out-of-stock products should remain visible
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Could not load live catalogue:", error.message);
        return;
      }

      if (active && data && data.length > 0) {
        setCatalogueProducts(data.map(product => ({
          ...product,
          icon: "🎆",
          desc: product.description || "Explore this festive collection."
        })));
      } else if (active && data && data.length === 0) {
        setCatalogueProducts([]);
      }
    }

    loadCatalogue();

    const channel = supabase
      .channel("public-products-catalogue")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "products" },
        loadCatalogue
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  if (window.location.pathname === "/admin") return <AdminPanel />;

  const filteredProducts = catalogueProducts.filter(product => {
    const q = search.toLowerCase();
    return (product.name.toLowerCase().includes(q) ||
      product.category.toLowerCase().includes(q)) &&
      (category === "All" || product.category === category);
  });

  return (
    <div className="site-shell">
      <div className="identity-bar">
        <div className="identity-card supplier-card">
          <span className="identity-label">SUPPLIER</span>
          <span className="identity-name">Moksh Bhutani</span>
        </div>
        <div className="identity-card developer-card">
          <span className="identity-label">WEB DEVELOPER</span>
          <span className="identity-name">Shivam Kadam</span>
        </div>
      </div>

      <nav className="navbar">
        <a className="brand" href="#home">BHUTANI FIREWORKS</a>
        <div className="nav-links">
          <a href="#home">Home</a>
          <a href="#collection">Catalogue</a>
          <a href="#about">About</a>
        </div>
        <a className="nav-cta" href="#collection">Explore Catalogue ↗</a>
      </nav>

      <main>
        <section className="hero" id="home">
          <div className="hero-copy">
            <span className="eyebrow">THE DIWALI COLLECTION · 2026</span>
            <h1>A little light.<br /><span>A lot of magic.</span></h1>
            <p>Discover the colours, traditions and festive spirit of Diwali with Bhutani Fireworks.</p>
            <a className="primary-button" href="#collection">Explore the Collection <span>↗</span></a>
            <div className="hero-note">
              <span className="status-dot" />
              A festive catalogue for informational purposes
            </div>
          </div>
          <div className="hero-art">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <span className="art-star star-one">✦</span>
            <span className="art-star star-two">✧</span>
            <span className="art-star star-three">✦</span>
            <div className="art-center">
              <span className="art-icon">🎆</span>
              <span className="art-caption">THE FESTIVE EDITION</span>
              <span className="art-year">DIWALI 2026</span>
            </div>
            <div className="art-bottom">LIGHT UP THE FESTIVE SPIRIT</div>
          </div>
        </section>

        <Announcements />

        <section className="collection" id="collection">
          <div className="section-heading">
            <div>
              <span className="eyebrow">EXPLORE OUR CATEGORIES</span>
              <h2>Made for festive moments.</h2>
              <p>A simple guide to traditional fireworks categories.</p>
            </div>
            <span className="collection-count">{filteredProducts.length.toString().padStart(2, "0")} CATEGORIES</span>
          </div>

          <div className="catalogue-controls">
            <div className="search-box">
              <span>⌕</span>
              <input type="text" placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="category-filters">
              {categories.map(item => (
                <button key={item} className={category === item ? "filter active" : "filter"} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="product-grid">
            {filteredProducts.map((product, index) => (
              <article className={`product-card product-${index % 4}`} key={product.name}>
                <div className="product-visual">
                  <span className="product-number">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`stock-badge ${product.available ? "in-stock" : "out-of-stock"}`}>
                    {product.available ? "IN STOCK" : "OUT OF STOCK"}
                  </span>
                  {product.image_url ? (
                    <img
                      className="product-photo"
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                    />
                  ) : (
                    <span className="product-icon">{product.icon}</span>
                  )}
                  <span className="visual-spark">✦</span>
                </div>
                <div className="product-info">
                  <span className="product-category">{product.category}</span>
                  <h3>{product.name}</h3>
                  <p>{product.desc}</p>
                  {product.price != null && (
                    <p className="product-price">
                      ₹{Number(product.price).toLocaleString("en-IN")}
                    </p>
                  )}
                  <div className="product-footer">
                    <span>FESTIVE COLLECTION</span>
                    <span className="product-arrow">↗</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {!filteredProducts.length && <div className="empty-state">No matching categories found. Try another search.</div>}

          <p className="catalogue-note">
            Informational catalogue only. Product availability and details have not been verified.
            Follow local laws and official firework safety guidance.
          </p>
        </section>

        <section className="about" id="about">
          <span className="eyebrow">OUR FESTIVE STORY</span>
          <h2>Tradition meets celebration.</h2>
          <p>Bhutani Fireworks presents a clean, modern catalogue celebrating the colours and traditions associated with Diwali.</p>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#home">BHUTANI FIREWORKS</a>
        <span>Made with care for the festive season ✨</span>
        <a href="#home">Back to top ↑</a>
      </footer>

      <FloatingContacts />
    </div>
  );
}

export default App;

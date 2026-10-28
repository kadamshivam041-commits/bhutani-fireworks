
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

const categories = [
  "Ground Fireworks",
  "Handheld Fireworks",
  "Aerial Fireworks",
  "Firecrackers",
];

export default function ProductManager() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [currentImage, setCurrentImage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadProducts() {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setNotice("Could not load products: " + error.message);
      return;
    }

    setProducts(data || []);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function resetForm() {
    setName("");
    setPrice("");
    setCategory(categories[0]);
    setDescription("");
    setImage(null);
    setCurrentImage("");
    setEditingId(null);
    setAvailable(true);

    const fileInput = document.getElementById("product-image");
    if (fileInput) fileInput.value = "";
  }

  function editProduct(product) {
    setEditingId(product.id);
    setName(product.name);
    setPrice(String(product.price));
    setCategory(product.category);
    setDescription(product.description || "");
    setCurrentImage(product.image_url || "");
    setAvailable(product.available);
    setImage(null);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct(event) {
    event.preventDefault();
    setLoading(true);
    setNotice("");

    try {
      let imageUrl = currentImage;

      if (image) {
        const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(filePath, image, { upsert: false });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from("product-images")
          .getPublicUrl(filePath);

        imageUrl = data.publicUrl;
      }

      const values = {
        name: name.trim(),
        price: Number(price),
        category,
        description: description.trim() || null,
        image_url: imageUrl || null,
        available,
        updated_at: new Date().toISOString(),
      };

      if (!values.name || price.trim() === "" ||
          !Number.isFinite(values.price) || values.price < 0) {
        throw new Error("Enter a product name and a valid non-negative price.");
      }

      const result = editingId
        ? await supabase.from("products").update(values).eq("id", editingId)
        : await supabase.from("products").insert([values]);

      if (result.error) throw result.error;

      resetForm();
      await loadProducts();
      setNotice(editingId ? "Product updated successfully!" : "Product added successfully!");
    } catch (error) {
      setNotice("Save failed: " + (error.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}" permanently?`)) return;

    setNotice("");

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id);

    if (error) {
      setNotice("Delete failed: " + error.message);
      return;
    }

    if (editingId === product.id) resetForm();

    await loadProducts();
    setNotice("Product deleted.");
  }

  return (
    <section className="admin-list">
      <h2>Product Manager</h2>
      <p>Add products, set prices and upload product photos for your catalogue.</p>

      <form className="admin-card" onSubmit={saveProduct}>
        <h2>{editingId ? "Edit Product" : "Add New Product"}</h2>

        <label>Product Name</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Enter product name"
          maxLength={150}
          required
        />

        <label>Price (₹)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={e => setPrice(e.target.value)}
          placeholder="Enter price"
          required
        />

        <label>Category</label>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
        >
          {categories.map(item => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>

        <label>Description (optional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Short product description"
        />

        <label>Product Photo</label>
        <input
          id="product-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={e => setImage(e.target.files?.[0] || null)}
        />

        {image && (
          <p>Selected photo: {image.name}</p>
        )}

        {!image && currentImage && (
          <img
            src={currentImage}
            alt="Current product"
            style={{ width: 140, maxHeight: 140, objectFit: "contain" }}
          />
        )}

        <label className="admin-checkbox">
          <input
            type="checkbox"
            checked={available}
            onChange={e => setAvailable(e.target.checked)}
          />
          In Stock (untick when out of stock)
        </label>

        <div className="admin-actions">
          <button className="admin-primary" type="submit" disabled={loading}>
            {loading ? "Saving..." : editingId ? "Save Changes" : "Add Product"}
          </button>

          {editingId && (
            <button
              className="admin-secondary"
              type="button"
              onClick={resetForm}
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      {notice && <p className="admin-notice">{notice}</p>}

      <h2>Saved Products ({products.length})</h2>

      {products.map(product => (
        <article className="admin-item" key={product.id}>
          <div>
            {product.image_url && (
              <img
                src={product.image_url}
                alt={product.name}
                style={{
                  width: 100,
                  height: 85,
                  objectFit: "contain",
                  borderRadius: 8,
                  background: "#fffdf8",
                }}
              />
            )}

            <h3>{product.name}</h3>
            <p>₹{Number(product.price).toLocaleString("en-IN")}</p>
            <p>{product.category}</p>
            <span className={product.available ? "admin-status live" : "admin-status"}>
              {product.available ? "IN STOCK" : "OUT OF STOCK"}
            </span>
          </div>

          <div className="admin-actions">
            <button
              className="admin-secondary"
              type="button"
              onClick={() => editProduct(product)}
            >
              Edit
            </button>

            <button
              className="admin-danger"
              type="button"
              onClick={() => deleteProduct(product)}
            >
              Delete
            </button>
          </div>
        </article>
      ))}

      {!products.length && <p>No products added yet.</p>}
    </section>
  );
}

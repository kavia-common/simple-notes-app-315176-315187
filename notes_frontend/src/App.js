import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = 'http://localhost:3001';

function formatTimestamp(ts) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return '';
  }
}

// PUBLIC_INTERFACE
function App() {
  const [notes, setNotes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [editorTitle, setEditorTitle] = useState('');
  const [editorContent, setEditorContent] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedNote = useMemo(
    () => notes.find(n => n.id === selectedId) || null,
    [notes, selectedId]
  );

  const hasLocalChanges = useMemo(() => {
    if (!selectedNote) return editorTitle.trim().length > 0 || editorContent.length > 0;
    return editorTitle !== selectedNote.title || editorContent !== selectedNote.content;
  }, [selectedNote, editorTitle, editorContent]);

  async function fetchJson(url, options) {
    const res = await fetch(url, options);
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || `Request failed: ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // PUBLIC_INTERFACE
  const loadNotes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await fetchJson(`${API_BASE}/notes`);
      setNotes(data);
      if (data.length && selectedId == null) {
        setSelectedId(data[0].id);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load notes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync editor with selection
  useEffect(() => {
    if (!selectedNote) {
      setEditorTitle('');
      setEditorContent('');
      return;
    }
    setEditorTitle(selectedNote.title);
    setEditorContent(selectedNote.content);
  }, [selectedNote]);

  // PUBLIC_INTERFACE
  const onNewNote = async () => {
    setIsSaving(true);
    setError('');
    try {
      const created = await fetchJson(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled', content: '' }),
      });
      // Put newest at top visually (backend sorts by updated_at desc).
      setNotes(prev => [created, ...prev.filter(n => n.id !== created.id)]);
      setSelectedId(created.id);
    } catch (e) {
      setError(e?.message || 'Failed to create note.');
    } finally {
      setIsSaving(false);
    }
  };

  // PUBLIC_INTERFACE
  const onSave = async () => {
    if (!selectedNote) return;

    setIsSaving(true);
    setError('');
    try {
      const updated = await fetchJson(`${API_BASE}/notes/${selectedNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editorTitle, content: editorContent }),
      });

      setNotes(prev => {
        const without = prev.filter(n => n.id !== updated.id);
        // updated_at changes, backend sorts by it; keep UX snappy by moving to top.
        return [updated, ...without];
      });
      setSelectedId(updated.id);
    } catch (e) {
      setError(e?.message || 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  // PUBLIC_INTERFACE
  const onDelete = async () => {
    if (!selectedNote) return;

    const ok = window.confirm(`Delete "${selectedNote.title}"? This cannot be undone.`);
    if (!ok) return;

    setIsSaving(true);
    setError('');
    try {
      await fetchJson(`${API_BASE}/notes/${selectedNote.id}`, { method: 'DELETE' });

      setNotes(prev => prev.filter(n => n.id !== selectedNote.id));
      setSelectedId(prevId => {
        if (prevId !== selectedNote.id) return prevId;
        const remaining = notes.filter(n => n.id !== selectedNote.id);
        return remaining.length ? remaining[0].id : null;
      });
    } catch (e) {
      setError(e?.message || 'Failed to delete note.');
    } finally {
      setIsSaving(false);
    }
  };

  const onSelect = id => {
    if (hasLocalChanges) {
      const ok = window.confirm('You have unsaved changes. Discard and switch notes?');
      if (!ok) return;
    }
    setSelectedId(id);
  };

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="brand">
          <div className="brandMark" aria-hidden="true" />
          <div className="brandText">
            <div className="brandTitle">Candy Notes</div>
            <div className="brandSubtitle">A tiny notes app</div>
          </div>
        </div>

        <div className="topActions">
          <button className="btn btnSecondary" onClick={loadNotes} disabled={isLoading || isSaving}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={onNewNote} disabled={isSaving}>
            + New
          </button>
        </div>
      </header>

      <main className="mainSplit">
        <aside className="sidebar" aria-label="Notes list">
          <div className="sidebarHeader">
            <div className="sidebarTitle">Notes</div>
            <div className="sidebarMeta">
              {isLoading ? 'Loading…' : `${notes.length} total`}
            </div>
          </div>

          {error ? (
            <div className="callout calloutError" role="alert">
              {error}
            </div>
          ) : null}

          <div className="noteList" role="list">
            {notes.map(n => {
              const active = n.id === selectedId;
              return (
                <button
                  key={n.id}
                  className={`noteListItem ${active ? 'active' : ''}`}
                  onClick={() => onSelect(n.id)}
                  role="listitem"
                >
                  <div className="noteTitleRow">
                    <div className="noteTitle">{n.title || 'Untitled'}</div>
                    {active && hasLocalChanges ? <span className="pill">Edited</span> : null}
                  </div>
                  <div className="notePreview">{(n.content || '').slice(0, 70) || 'No content'}</div>
                  <div className="noteTime">Updated {formatTimestamp(n.updated_at)}</div>
                </button>
              );
            })}
            {!isLoading && notes.length === 0 ? (
              <div className="emptyState">
                <div className="emptyTitle">No notes yet</div>
                <div className="emptyBody">Create your first note to get started.</div>
                <button className="btn btnPrimary" onClick={onNewNote} disabled={isSaving}>
                  + New note
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="editor" aria-label="Editor">
          {!selectedNote ? (
            <div className="editorEmpty">
              <div className="editorEmptyTitle">Select a note</div>
              <div className="editorEmptyBody">
                Choose a note from the list or create a new one.
              </div>
            </div>
          ) : (
            <>
              <div className="editorHeader">
                <input
                  className="titleInput"
                  value={editorTitle}
                  onChange={e => setEditorTitle(e.target.value)}
                  placeholder="Title"
                  aria-label="Note title"
                />
                <div className="editorButtons">
                  <button
                    className="btn btnGhostDanger"
                    onClick={onDelete}
                    disabled={isSaving}
                    title="Delete note"
                  >
                    Delete
                  </button>
                  <button
                    className="btn btnSuccess"
                    onClick={onSave}
                    disabled={isSaving || !hasLocalChanges || editorTitle.trim().length === 0}
                    title="Save changes"
                  >
                    {isSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>

              <textarea
                className="contentArea"
                value={editorContent}
                onChange={e => setEditorContent(e.target.value)}
                placeholder="Write your note here…"
                aria-label="Note content"
              />

              <div className="editorFooter">
                <div className="muted">
                  Created {formatTimestamp(selectedNote.created_at)} • Updated{' '}
                  {formatTimestamp(selectedNote.updated_at)}
                </div>
                {hasLocalChanges ? <div className="muted">Unsaved changes</div> : <div className="muted">All changes saved</div>}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

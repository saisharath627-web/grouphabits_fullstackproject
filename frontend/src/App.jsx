import React, { useState, useEffect, useCallback } from 'react';

// Uses VITE_API_URL in cloud deployment (e.g., https://your-api.onrender.com/api)
// Falls back to '/api' for local Vite proxy or same-origin hosting (zero localhost hardcoding)
const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
const API_BASE = rawApiUrl
  ? rawApiUrl.endsWith('/api')
    ? rawApiUrl
    : `${rawApiUrl}/api`
  : '/api';

async function parseApiResponse(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `Server returned an unexpected response (${res.status}). Check that VITE_API_URL points to your live backend.`
    );
  }
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}

export default function App() {
  const [goals, setGoals] = useState([]);
  const [selectedGoalId, setSelectedGoalId] = useState('');
  const [activeData, setActiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [myPrivateLogs, setMyPrivateLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('my_movement_contributions') || '{}');
    } catch {
      return {};
    }
  });

  const [showNewGoalForm, setShowNewGoalForm] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    unit: 'minutes',
    targetValue: ''
  });

  const [activityForm, setActivityForm] = useState({
    participantName: '',
    activityType: 'Walking / Jogging',
    amount: '',
    note: '',
    isPrivate: false
  });

  const fetchGoals = useCallback(async () => {
    try {
      setError('');
      const res = await fetch(`${API_BASE}/goals`);
      const json = await parseApiResponse(res);

      setGoals(json.data);
      if (json.data.length > 0 && !selectedGoalId) {
        setSelectedGoalId(json.data[0]._id);
      } else if (json.data.length === 0) {
        setLoading(false);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [selectedGoalId]);

  const fetchGoalDetails = useCallback(async (goalId) => {
    if (!goalId) return;
    setLoading(true);
    try {
      setError('');
      const res = await fetch(`${API_BASE}/goals/${goalId}`);
      const json = await parseApiResponse(res);
      setActiveData(json.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  useEffect(() => {
    if (selectedGoalId) {
      fetchGoalDetails(selectedGoalId);
    }
  }, [selectedGoalId, fetchGoalDetails]);

  const handleCreateGoal = async (e) => {
    e.preventDefault();
    if (!newGoal.title.trim() || Number(newGoal.targetValue) <= 0) {
      setError('Please provide a valid title and positive target number.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/goals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newGoal,
          targetValue: Number(newGoal.targetValue)
        })
      });
      const json = await parseApiResponse(res);

      setGoals((prev) => [json.data, ...prev]);
      setSelectedGoalId(json.data._id);
      setNewGoal({ title: '', description: '', unit: 'minutes', targetValue: '' });
      setShowNewGoalForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogActivity = async (e) => {
    e.preventDefault();
    const numericAmount = Number(activityForm.amount);
    if (!numericAmount || numericAmount <= 0) {
      setError('Please enter a valid positive number for your activity.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/goals/${selectedGoalId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...activityForm,
          amount: numericAmount
        })
      });
      const json = await parseApiResponse(res);

      setActiveData((prev) => ({
        goal: json.data.goal,
        feed: [json.data.log, ...(prev?.feed || [])]
      }));

      setGoals((prev) =>
        prev.map((g) => (g._id === json.data.goal._id ? json.data.goal : g))
      );

      const updatedPersonal = {
        ...myPrivateLogs,
        [selectedGoalId]: Number(
          ((myPrivateLogs[selectedGoalId] || 0) + numericAmount).toFixed(2)
        )
      };
      setMyPrivateLogs(updatedPersonal);
      localStorage.setItem('my_movement_contributions', JSON.stringify(updatedPersonal));

      setActivityForm((prev) => ({
        ...prev,
        amount: '',
        note: ''
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentGoal = activeData?.goal;
  const percentComplete = currentGoal
    ? Math.min(100, Math.round((currentGoal.currentProgress / currentGoal.targetValue) * 100))
    : 0;
  const myPersonalTotal = selectedGoalId ? myPrivateLogs[selectedGoalId] || 0 : 0;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand">
          <h1>StrideTogether</h1>
          <p>Shared movement goals • No leaderboards, no pressure</p>
        </div>
        {currentGoal && (
          <div className="private-stats-pill">
            Your private total on this goal:{' '}
            <strong>
              {myPersonalTotal} {currentGoal.unit}
            </strong>
          </div>
        )}
      </header>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}

      <div className="dashboard-grid">
        <aside>
          <div className="card">
            <h2>Campus & Friend Goals</h2>
            {goals.length === 0 && !loading ? (
              <p className="supportive-note">No group challenges yet. Start one below!</p>
            ) : (
              <div className="goal-list">
                {goals.map((goal) => (
                  <button
                    key={goal._id}
                    className={`goal-item ${goal._id === selectedGoalId ? 'active' : ''}`}
                    onClick={() => setSelectedGoalId(goal._id)}
                  >
                    <span className="goal-item-title">{goal.title}</span>
                    <span className="goal-item-meta">
                      {goal.currentProgress} / {goal.targetValue} {goal.unit}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowNewGoalForm(!showNewGoalForm)}
            >
              {showNewGoalForm ? 'Cancel' : '+ New Group Goal'}
            </button>

            {showNewGoalForm && (
              <form onSubmit={handleCreateGoal} style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Goal Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Hostel Evening Walk"
                    value={newGoal.title}
                    onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
                    required
                    maxLength={100}
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <input
                    type="text"
                    placeholder="Optional supportive note"
                    value={newGoal.description}
                    onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
                    maxLength={300}
                  />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Target *</label>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="500"
                      value={newGoal.targetValue}
                      onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Unit *</label>
                    <select
                      value={newGoal.unit}
                      onChange={(e) => setNewGoal({ ...newGoal, unit: e.target.value })}
                    >
                      <option value="minutes">minutes</option>
                      <option value="km">km</option>
                      <option value="steps">steps</option>
                      <option value="sessions">sessions</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Group Goal'}
                </button>
              </form>
            )}
          </div>
        </aside>

        <main>
          {loading ? (
            <div className="card">
              <p className="supportive-note">Loading group progress...</p>
            </div>
          ) : !currentGoal ? (
            <div className="card">
              <h3>Welcome to StrideTogether</h3>
              <p className="supportive-note">
                Create a group goal on the left to start tracking collective movement together.
              </p>
            </div>
          ) : (
            <>
              <section className="card">
                <div className="progress-header">
                  <div>
                    <h2>{currentGoal.title}</h2>
                    {currentGoal.description && (
                      <p className="supportive-note">{currentGoal.description}</p>
                    )}
                  </div>
                  <div className="progress-numbers">
                    {currentGoal.currentProgress} / {currentGoal.targetValue} {currentGoal.unit}
                  </div>
                </div>

                <div
                  className="progress-track"
                  role="progressbar"
                  aria-valuenow={percentComplete}
                  aria-valuemin="0"
                  aria-valuemax="100"
                >
                  <div className="progress-fill" style={{ width: `${percentComplete}%` }} />
                </div>

                <p className="supportive-note">
                  {percentComplete >= 100
                    ? 'Goal reached! Keep moving together at your own pace.'
                    : `${percentComplete}% toward our shared milestone — every bit of movement counts.`}
                </p>
              </section>

              <section className="card">
                <h3>Log Movement</h3>
                <form onSubmit={handleLogActivity}>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Activity Type *</label>
                      <select
                        value={activityForm.activityType}
                        onChange={(e) =>
                          setActivityForm({ ...activityForm, activityType: e.target.value })
                        }
                      >
                        <option value="Walking / Jogging">Walking / Jogging</option>
                        <option value="Cycling">Cycling</option>
                        <option value="Yoga / Stretching">Yoga / Stretching</option>
                        <option value="Campus Sports">Campus Sports</option>
                        <option value="Strength / Bodyweight">Strength / Bodyweight</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Amount ({currentGoal.unit}) *</label>
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        placeholder="e.g., 30"
                        value={activityForm.amount}
                        onChange={(e) =>
                          setActivityForm({ ...activityForm, amount: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  {!activityForm.isPrivate && (
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Display Name (optional)</label>
                        <input
                          type="text"
                          placeholder="Leave blank for Anonymous Mover"
                          value={activityForm.participantName}
                          onChange={(e) =>
                            setActivityForm({ ...activityForm, participantName: e.target.value })
                          }
                          maxLength={50}
                        />
                      </div>
                      <div className="form-group">
                        <label>Short Note (optional)</label>
                        <input
                          type="text"
                          placeholder="e.g., Walked around campus lake"
                          value={activityForm.note}
                          onChange={(e) =>
                            setActivityForm({ ...activityForm, note: e.target.value })
                          }
                          maxLength={200}
                        />
                      </div>
                    </div>
                  )}

                  <label className="privacy-toggle">
                    <input
                      type="checkbox"
                      checked={activityForm.isPrivate}
                      onChange={(e) =>
                        setActivityForm({ ...activityForm, isPrivate: e.target.checked })
                      }
                    />
                    <span>
                      <strong>Participate Privately:</strong> Your activity adds to the group
                      progress bar, but your name, activity type, and note stay hidden from the
                      shared feed.
                    </span>
                  </label>

                  <button type="submit" className="btn" disabled={submitting}>
                    {submitting ? 'Adding to Group Progress...' : 'Add Activity'}
                  </button>
                </form>
              </section>

              <section className="card">
                <h3>Recent Group Momentum</h3>
                {activeData?.feed?.length === 0 ? (
                  <p className="supportive-note">
                    No activities logged yet. Be the first to add some gentle movement!
                  </p>
                ) : (
                  <div className="feed-list">
                    {activeData?.feed?.map((item) => (
                      <div
                        key={item._id}
                        className={`feed-item ${item.isPrivate ? 'private-entry' : ''}`}
                      >
                        <div>
                          <div className="feed-who">
                            {item.participantName}
                            {item.isPrivate && <span className="badge-private">Private</span>}
                          </div>
                          <div className="feed-detail">
                            {item.activityType}
                            {item.note ? ` — "${item.note}"` : ''}
                          </div>
                        </div>
                        <div className="feed-amount">
                          +{item.amount} {currentGoal.unit}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
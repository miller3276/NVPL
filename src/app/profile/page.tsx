
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [userId, setUserId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [username, setUsername] = useState('')
  const [gamertag, setGamertag] = useState('')
  const [bio, setBio] = useState('')
  const [country, setCountry] = useState('')
  const [region, setRegion] = useState('OCE')
  const [discord, setDiscord] = useState('')
  const [instagram, setInstagram] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        window.location.href = '/login'
        return
      }

      setUserId(user.id)

      const { data, error } = await supabase
        .from('player_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        setMessage(error.message)
      } else if (data) {
        setProfileId(data.id)
        setUsername(data.username || '')
        setGamertag(data.gamertag || '')
        setBio(data.bio || '')
        setCountry(data.country || '')
        setRegion(data.region || 'OCE')
        setDiscord(data.discord_username || '')
        setInstagram(data.instagram_username || '')
        setAvatarUrl(data.avatar_url || '')
      } else {
        setMessage('Create your player profile before editing these details.')
      }

      setLoading(false)
    }

    loadProfile()
  }, [])

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()

    if (!profileId || !userId) return

    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase()

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      setMessage('Username must be 3–20 characters and use only letters, numbers or underscores.')
      return
    }

    setSaving(true)
    setMessage('')

    const { error } = await supabase
      .from('player_profiles')
      .update({
        username: cleanUsername,
        gamertag: gamertag.trim(),
        bio: bio.trim(),
        country: country.trim(),
        region,
        discord_username: discord.trim(),
        instagram_username: instagram.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', profileId)
      .eq('user_id', userId)

    if (error?.code === '23505') {
      setMessage('That NVPL username is already taken. Try another one.')
    } else if (error) {
      setMessage(error.message)
    } else {
      setUsername(cleanUsername)
      setMessage('Your NVPL profile has been updated!')
    }

    setSaving(false)
  }

  async function uploadAvatar() {
    if (!selectedFile || !userId || !profileId) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
      setMessage('Please choose a JPG, PNG or WebP image.')
      return
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setMessage('Your image must be smaller than 5 MB.')
      return
    }

    setUploading(true)
    setMessage('')

    const extension =
      selectedFile.type === 'image/png' ? 'png' :
      selectedFile.type === 'image/webp' ? 'webp' : 'jpg'

    const filePath = `${userId}/${Date.now()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, selectedFile, {
        contentType: selectedFile.type,
        upsert: false
      })

    if (uploadError) {
      setMessage(uploadError.message)
      setUploading(false)
      return
    }

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)

    const newAvatarUrl = data.publicUrl

    const { error: updateError } = await supabase
      .from('player_profiles')
      .update({ avatar_url: newAvatarUrl })
      .eq('id', profileId)
      .eq('user_id', userId)

    if (updateError) {
      setMessage(updateError.message)
    } else {
      setAvatarUrl(newAvatarUrl)
      setSelectedFile(null)
      setMessage('Profile picture uploaded successfully!')
    }

    setUploading(false)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080d18] text-white p-8">
        Loading profile...
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#080d18] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard" className="text-blue-400">
          ← Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold mt-8">My NVPL Profile</h1>
        <p className="text-gray-400 mt-2 mb-8">
          Manage your NVPL account and player information.
        </p>

        {message && (
          <div className="bg-[#17243a] border border-[#263957] p-4 rounded-lg mb-6">
            {message}
          </div>
        )}

        {profileId && (
          <>
            <section className="bg-[#111c30] border border-[#263957] rounded-xl p-6 mb-6">
              <h2 className="text-xl font-bold mb-5">Profile Picture</h2>

              <div className="flex items-center gap-5 mb-5">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Player profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-blue-500"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-[#263957] flex items-center justify-center text-3xl font-bold">
                    {username.charAt(0).toUpperCase() || '?'}
                  </div>
                )}

                <div>
                  <p className="font-bold">@{username || 'Choose a username'}</p>
                  <p className="text-gray-400 text-sm">{gamertag}</p>
                </div>
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-300 mb-4"
              />

              <button
                type="button"
                onClick={uploadAvatar}
                disabled={!selectedFile || uploading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg px-5 py-3 font-bold"
              >
                {uploading ? 'Uploading...' : 'Upload Picture'}
              </button>

              <p className="text-gray-500 text-xs mt-3">
                JPG, PNG or WebP. Maximum size: 5 MB.
              </p>
            </section>

            <form onSubmit={saveProfile} className="bg-[#111c30] border border-[#263957] rounded-xl p-6 space-y-5">
              <h2 className="text-xl font-bold">Account Information</h2>

              <div>
                <label className="block text-sm text-gray-300 mb-2">
                  NVPL Username
                </label>
                <div className="flex items-center bg-[#080d18] border border-gray-700 rounded-lg px-3">
                  <span className="text-gray-400">@</span>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value.replace(/^@/, ''))}
                    required
                    minLength={3}
                    maxLength={20}
                    placeholder="YourUsername"
                    className="w-full bg-transparent p-3 outline-none"
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  3–20 characters. Letters, numbers and underscores only. Must be unique.
                </p>
              </div>

              <h2 className="text-xl font-bold pt-3">Player Information</h2>

              <div>
                <label className="block text-sm text-gray-300 mb-2">EA FC Gamertag</label>
                <input
                  value={gamertag}
                  onChange={e => setGamertag(e.target.value)}
                  required
                  maxLength={40}
                  className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-3"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Bio</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  maxLength={300}
                  rows={4}
                  placeholder="Tell the NVPL community about yourself..."
                  className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-3"
                />
                <p className="text-gray-500 text-xs mt-1">{bio.length}/300 characters</p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Country</label>
                <input
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. Australia"
                  className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-3"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Region</label>
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                  className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-3"
                >
                  <option value="OCE">Oceania</option>
                  <option value="EU">Europe</option>
                  <option value="NA">North America</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Discord Username</label>
                <input
                  value={discord}
                  onChange={e => setDiscord(e.target.value)}
                  maxLength={50}
                  className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-3"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-2">Instagram Username</label>
                <input
                  value={instagram}
                  onChange={e => setInstagram(e.target.value)}
                  maxLength={50}
                  className="w-full bg-[#080d18] border border-gray-700 rounded-lg p-3"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg p-4 font-bold"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}

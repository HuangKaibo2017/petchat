const CDN_BASE = 'https://dlvgbwyvxjdggxpddpod.supabase.co/storage/v1/object/public/gengdongta-assets'

function getImageUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/images/')) {
    return CDN_BASE + path
  }
  return CDN_BASE + '/images/' + path
}

module.exports = {
  CDN_BASE,
  getImageUrl,
}

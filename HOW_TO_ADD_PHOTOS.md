# How to Add Photos to Your Wedding Site

## Where the Photos Are

The photos are in the guest portal home page. There are **4 image placeholders**:

1. **Main Hero Photo** - Large banner at the top
2. **Photo 1** - First grid photo
3. **Photo 2** - Second grid photo  
4. **Photo 3** - Third grid photo

## Option 1: Direct Image URLs (Easiest)

If your photos are hosted online (e.g., Imgur, Google Photos, Dropbox, etc.), you can use direct URLs.

### Step 1: Get Image URLs

1. Upload your photos to an image hosting service:
   - **Imgur**: https://imgur.com (free, easy)
   - **Google Photos**: Share → Get link
   - **Dropbox**: Share → Copy link
   - **Cloudinary**: Professional option

2. Get the **direct image URL** (ends in .jpg, .png, etc.)

### Step 2: Edit the File

Open: `wedding-planner-frontend/src/pages/guest/Home.jsx`

Find these sections and replace with your image URLs:

**Main Hero Photo (around line 83):**
```jsx
{/* Replace this placeholder div with: */}
<img 
  src="YOUR_IMAGE_URL_HERE" 
  alt="Couple Photo"
  className="w-full h-96 object-cover"
/>
```

**Grid Photos (around line 108):**
```jsx
{/* Replace each placeholder div with: */}
<img 
  src="YOUR_IMAGE_URL_HERE" 
  alt="Wedding Photo"
  className="w-full h-64 object-cover rounded-2xl"
/>
```

## Option 2: Store Images in Public Folder

### Step 1: Add Images to Project

1. Create a folder: `wedding-planner-frontend/public/images/`
2. Add your photos there:
   - `couple-hero.jpg`
   - `photo1.jpg`
   - `photo2.jpg`
   - `photo3.jpg`

### Step 2: Reference in Code

```jsx
{/* Main Hero */}
<img 
  src="/images/couple-hero.jpg" 
  alt="Couple Photo"
  className="w-full h-96 object-cover"
/>

{/* Grid Photos */}
<img 
  src="/images/photo1.jpg" 
  alt="Wedding Photo 1"
  className="w-full h-64 object-cover rounded-2xl"
/>
```

## Option 3: Use Content Management (Recommended)

You can add image URLs through the **Content Management** page in the admin dashboard:

1. Login to admin dashboard
2. Go to **Content** page
3. Create content items with image URLs
4. Display them dynamically

## Quick Example

Here's how to replace the main hero photo:

**Find this (around line 83):**
```jsx
<div className="relative h-96 bg-gradient-to-br from-pink-200 via-purple-200 to-pink-300 flex items-center justify-center">
  <div className="text-center z-10">
    <Camera className="w-16 h-16 text-white/80 mx-auto mb-4" />
    <p className="text-white/90 text-lg font-medium">Couple Photo</p>
    <p className="text-white/70 text-sm mt-2">Upload your beautiful photo here</p>
  </div>
  <div className="absolute inset-0 bg-black/10"></div>
</div>
```

**Replace with:**
```jsx
<div className="relative h-96 overflow-hidden">
  <img 
    src="https://your-image-url.com/couple-photo.jpg" 
    alt="Couple Photo"
    className="w-full h-full object-cover"
  />
  <div className="absolute inset-0 bg-black/20"></div>
  {/* Header Text */}
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="max-w-4xl mx-auto text-center px-4">
      <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 drop-shadow-lg">
        We're Getting Married!
      </h1>
      <p className="text-xl text-white/90 mb-8 drop-shadow-md">
        Please join us for our special day
      </p>
    </div>
  </div>
</div>
```

## Image Hosting Recommendations

### Free Options:
- **Imgur**: https://imgur.com - Easy, no account needed
- **ImgBB**: https://imgbb.com - Direct links
- **PostImage**: https://postimg.cc - Simple hosting

### Professional Options:
- **Cloudinary**: https://cloudinary.com - Free tier available
- **AWS S3**: If you want full control
- **Vercel Blob**: Integrated with Vercel

## Tips

1. **Image Sizes**: 
   - Hero photo: 1920x600px (or similar wide format)
   - Grid photos: 800x600px (or square)

2. **File Formats**: 
   - Use JPG for photos (smaller file size)
   - Use PNG for graphics with transparency

3. **Optimization**: 
   - Compress images before uploading (use TinyPNG or similar)
   - Smaller files = faster loading

4. **Backup**: 
   - Keep original photos safe
   - Store URLs in a document

## After Adding Photos

1. Save the file
2. Push to GitHub: `git add . && git commit -m "Add wedding photos" && git push`
3. Vercel will auto-deploy
4. Check your site - photos should appear!

## Need Help?

If you want me to update the code with your image URLs, just provide:
- The image URLs
- Which photo goes where (hero, photo1, photo2, photo3)

I can update the file for you!


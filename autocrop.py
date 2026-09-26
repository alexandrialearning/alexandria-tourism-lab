import sys
try:
    from PIL import Image, ImageChops
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageChops

def trim(im):
    # Convert to RGBA if not already
    im = im.convert("RGBA")
    # Get bounding box of non-transparent and non-white pixels
    # Let's create a mask of pixels that are NOT white and NOT transparent
    # A pixel is background if it's transparent (A==0) OR white (R>240, G>240, B>240)
    data = im.getdata()
    newData = []
    for item in data:
        # if transparent or white, make it fully transparent white
        if item[3] == 0 or (item[0] > 240 and item[1] > 240 and item[2] > 240):
            newData.append((255, 255, 255, 0))
        else:
            newData.append(item)
    im.putdata(newData)
    
    bbox = im.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

if __name__ == "__main__":
    img = Image.open('logo.png')
    cropped_img = trim(img)
    cropped_img.save('logo.png')
    print("Image cropped successfully.")

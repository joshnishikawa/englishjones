////////////////////////////////////////////////////////////////////////////////
// dressup.js — Drag-to-dress character activity.
//
// PATTERN: Takes a config object with CSS selectors for clothing items,
//   character element, and clothing class name. Uses jQuery animation
//   for fly-to-character / fly-back-to-menu effects.
//
// CLICK-THROUGH: Implements pixel-level transparency detection to handle
//   stacked clothing. If you click a transparent area of the top garment,
//   it checks items underneath using canvas pixel inspection.
//
// POTENTIAL ISSUE: `isClickOnTransparentArea()` creates a new <canvas> and
//   draws the image on EVERY click. Fine for occasional clicks, but could
//   be slow if users click rapidly on complex images. Could cache the
//   canvas or use a lookup.
////////////////////////////////////////////////////////////////////////////////

// Shared dressup functionality
function initializeDressup(config) {
  let clothingCounter = 0; // Unique ID counter for clothing items
  let clothingOnCharacter = {}; // Track which clothing items are on the character
  
  const clothingSelector = config.clothingSelector;
  const characterSelector = config.characterSelector;
  const clothingClass = config.clothingClass;
  const resetSelector = config.resetSelector || '#reset-btn';

  // Semantic Z-index map for natural garment layering
  function getClothingZIndex(clothingType) {
    const zIndexMap = {
      // Accessories (face level)
      'sunglasses': 50,
      // Hats & Headwear
      'cap': 40,
      'hat': 40,
      'knit_cap': 40,
      // Outerwear
      'coat': 30,
      'vest': 28,
      // Tops
      'sweater': 25,
      'shirt': 20,
      'dress_shirt': 20,
      'dog_T-shirt': 20,
      'long-sleeve_T-shirt': 20,
      'ong-sleeve_T-shirt': 20,
      'T-shirt': 20,
      'blouse': 20,
      'dress': 20,
      'pjs': 20,
      // Shoes & Footwear
      'boots': 15,
      'snow_boots': 15,
      'hiking_boots': 15,
      'sneakers': 15,
      'shoes': 15,
      // Bottoms
      'pants': 10,
      'jeans': 10,
      'shorts': 10,
      'cargo_shorts': 10,
      'cargo_skirt': 10,
      'skirt': 10,
      'other_pants': 10
    };
    return zIndexMap[clothingType] || 10;
  }
  
  // CLOTHING FUNCTIONALITY
  $(clothingSelector).on('click', function(e) {
    let $clicked = $(this);
    let $clickedImg = $clicked.is('img') ? $clicked : $clicked.find('img');
    if (!$clickedImg.length) return;

    let clothingType = $clickedImg.attr('alt');
    
    // Check if this clothing item is already on the character
    if (clothingOnCharacter[clothingType]) {
      return; // Don't add duplicates
    }

    let $character = $(characterSelector);
    let $characterContainer = $character.parent();
    
    let clickedOffset = $clickedImg.offset();
    let originalWidth = $clickedImg.width();
    let originalHeight = $clickedImg.height();
    let originalOffset = clickedOffset;

    // Check if coordinate attributes are present
    let hasCoords = $clickedImg.attr('data-left') !== undefined;
    let coord = {
      left: parseFloat($clickedImg.attr('data-left')),
      top: parseFloat($clickedImg.attr('data-top')),
      width: parseFloat($clickedImg.attr('data-width')),
      height: parseFloat($clickedImg.attr('data-height')),
      zIndex: parseInt($clickedImg.attr('data-zindex')) || getClothingZIndex(clothingType)
    };

    let targetScreenLeft, targetScreenTop, targetWidthPx, targetHeightPx;

    if (hasCoords && !isNaN(coord.left)) {
      let charOffset = $characterContainer.offset();
      let charWidth = $characterContainer.width();
      let charHeight = $characterContainer.height();

      targetWidthPx = (coord.width / 100) * charWidth;
      targetHeightPx = (coord.height / 100) * charHeight;
      targetScreenLeft = charOffset.left + (coord.left / 100) * charWidth;
      targetScreenTop = charOffset.top + (coord.top / 100) * charHeight;
    } else {
      // Legacy full-body overlay mode (e.g. girl)
      let characterOffset = $character.offset();
      targetScreenLeft = characterOffset.left;
      targetScreenTop = characterOffset.top;
      targetWidthPx = $character.width();
      targetHeightPx = $character.height();
    }
    
    // Create a clone to move to the character
    let $clonedImg = $clickedImg.clone();
    let uniqueId = 'clothing-' + (++clothingCounter);
    $clonedImg.attr('data-clothing-id', uniqueId);
    $clonedImg.attr('data-clothing-type', clothingType);
    
    // Mark this clothing type as being on the character
    clothingOnCharacter[clothingType] = {
      uniqueId: uniqueId,
      originalElement: $clickedImg,
      originalOffset: originalOffset,
      originalWidth: originalWidth,
      originalHeight: originalHeight,
      hasCoords: hasCoords,
      coord: coord
    };
    
    // Mark item as worn
    $clickedImg.addClass('is-worn');
    
    // Move clone to body for animation with fixed positioning
    $clonedImg.css({
      position: 'fixed',
      left: clickedOffset.left,
      top: clickedOffset.top,
      width: originalWidth,
      height: originalHeight,
      zIndex: 1000,
      border: 'none',
      padding: 0,
      margin: 0
    }).appendTo('body');
    
    // Animate to character's position and resize
    $clonedImg.animate({
      left: targetScreenLeft,
      top: targetScreenTop,
      width: targetWidthPx,
      height: targetHeightPx
    }, 450, 'swing', function() {
      if (hasCoords && !isNaN(coord.left)) {
        $clonedImg.css({
          position: 'absolute',
          left: coord.left + '%',
          top: coord.top + '%',
          width: coord.width + '%',
          height: coord.height + '%',
          zIndex: coord.zIndex,
          cursor: 'pointer'
        }).appendTo($characterContainer);
      } else {
        $clonedImg.css({
          position: 'absolute',
          left: 0,
          top: 0,
          height: $character.height() ? $character.height() + 'px' : '600px',
          width: 'auto',
          border: 'none',
          padding: 0,
          margin: 0,
          zIndex: coord.zIndex,
          cursor: 'pointer'
        }).appendTo($characterContainer);
      }
      
      $clonedImg.addClass(clothingClass);
    });
  });
  
  // Handle clicks on clothing items overlaid on the character.
  // Uses transparency detection to pass clicks through to items underneath.
  $(document).on('click', '.' + clothingClass, function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    let $clickedClothing = $(this);
    let targetItem = findClickableItemAtPoint($clickedClothing, e, clothingOnCharacter);
    
    if (targetItem && targetItem[0] !== $clickedClothing[0]) {
      targetItem.trigger('click');
      return;
    }
    
    removeClothingItem($clickedClothing, clothingOnCharacter);
  });

  // Function to remove a clothing item and animate it back
  function removeClothingItem($clickedClothing, clothingTracker) {
    let uniqueId = $clickedClothing.attr('data-clothing-id');
    let clothingType = $clickedClothing.attr('data-clothing-type');
    
    let originalData = clothingTracker[clothingType];
    if (originalData) {
      let $originalElement = originalData.originalElement;
      let originalOffset = $originalElement.offset() || originalData.originalOffset;
      
      let currentOffset = $clickedClothing.offset();
      let currentWidth = $clickedClothing.width();
      let currentHeight = $clickedClothing.height();
      
      let targetWidth = originalData.originalWidth;
      let targetHeight = originalData.originalHeight;
      
      $clickedClothing.css({
        position: 'fixed',
        left: currentOffset.left,
        top: currentOffset.top,
        width: currentWidth,
        height: currentHeight,
        zIndex: 1000,
        border: 'none',
        cursor: 'pointer'
      }).appendTo('body');
      
      $clickedClothing.animate({
        left: originalOffset.left,
        top: originalOffset.top,
        width: targetWidth,
        height: targetHeight
      }, 400, 'swing', function() {
        $clickedClothing.remove();
        $originalElement.removeClass('is-worn');
        delete clothingTracker[clothingType];
      });
    }
  }

  // Reset button to remove all clothes from the character
  if (resetSelector) {
    $(resetSelector).on('click', function(e) {
      e.preventDefault();
      $('.' + clothingClass).each(function() {
        removeClothingItem($(this), clothingOnCharacter);
      });
    });
  }
  
  // Function to recursively find the deepest clickable item at a point
  function findClickableItemAtPoint($startItem, event, clothingTracker) {
    let itemsToCheck = [$startItem];
    let checkedItems = [];
    
    while (itemsToCheck.length > 0) {
      let $currentItem = itemsToCheck.shift();
      checkedItems.push($currentItem);
      
      // Check if click is on transparent area of current item
      if (!isClickOnTransparentArea($currentItem[0], event)) {
        return $currentItem;
      }
      
      // Hide all checked items temporarily to find what's underneath
      checkedItems.forEach(function($item) {
        $item.css('pointer-events', 'none');
      });
      
      let elementBelow = document.elementFromPoint(event.clientX, event.clientY);
      
      // Restore pointer events
      checkedItems.forEach(function($item) {
        $item.css('pointer-events', 'auto');
      });
      
      // If we found another clothing item below, add it to the check list
      if (elementBelow && $(elementBelow).hasClass(clothingClass)) {
        let $itemBelow = $(elementBelow);
        // Only add if we haven't already checked this item
        let alreadyChecked = checkedItems.some(function($item) {
          return $item[0] === $itemBelow[0];
        });
        if (!alreadyChecked) {
          itemsToCheck.push($itemBelow);
        }
      }
    }
    
    // If we get here, all items at this point are transparent
    return null;
  }
  
  // Function to check if click is on transparent area of image
  function isClickOnTransparentArea(img, event) {
    let canvas = document.createElement('canvas');
    let ctx = canvas.getContext('2d');
    
    // Set canvas size to match image
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    
    // Draw image to canvas
    ctx.drawImage(img, 0, 0);
    
    // Calculate click position relative to image
    let rect = img.getBoundingClientRect();
    let x = Math.floor((event.clientX - rect.left) / rect.width * canvas.width);
    let y = Math.floor((event.clientY - rect.top) / rect.height * canvas.height);
    
    // Get pixel data at click position
    try {
      let pixelData = ctx.getImageData(x, y, 1, 1).data;
      let alpha = pixelData[3]; // Alpha channel (transparency)
      
      // Consider alpha < 50 as transparent (adjust threshold as needed)
      return alpha < 50;
    } catch (e) {
      // If we can't read pixel data (CORS issues), assume not transparent
      return false;
    }
  }
}

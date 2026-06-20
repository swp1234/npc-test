/* NPC Test - RPG Dialogue Tree */
(function() {
  'use strict';

  // 10 scenes, each with an NPC who says a line, then 2-3 choices
  // Each choice has a point value (0-3) and triggers an NPC reaction
  var TOTAL_SCENES = 10;
  var MAX_RAW_SCORE = 30; // max 3 per scene

  // NPC emojis for each scene
  var NPC_EMOJIS = [
    '\uD83E\uDDD9', // wizard
    '\uD83E\uDD34', // king
    '\uD83D\uDC7B', // ghost
    '\uD83E\uDDD4', // old man
    '\uD83D\uDC31', // cat
    '\uD83E\uDD16', // robot
    '\uD83E\uDDDA', // fairy
    '\uD83D\uDE08', // imp
    '\uD83E\uDDB8', // superhero
    '\uD83D\uDC80'  // skull
  ];

  // 5 result tiers
  var TIERS = [
    { key: 'npc',   emoji: '\uD83E\uDD16', min: 0,  max: 20 },
    { key: 'extra', emoji: '\uD83D\uDC7B', min: 21, max: 40 },
    { key: 'side',  emoji: '\u26A1',        min: 41, max: 60 },
    { key: 'main',  emoji: '\uD83D\uDC51', min: 61, max: 80 },
    { key: 'boss',  emoji: '\uD83D\uDD25', min: 81, max: 100 }
  ];

  // State
  var currentScene = 0;
  var totalRawScore = 0;
  var finalPercent = 0;
  var resultTier = null;
  var currentPercentile = null;
  var isTyping = false;
  var typingTimeout = null;
  var resultInlineAdLoaded = false;

  // DOM elements
  var introScreen = document.getElementById('intro');
  var dialogueScreen = document.getElementById('dialogue');
  var resultScreen = document.getElementById('result');
  var startBtn = document.getElementById('startBtn');

  // Dialogue elements
  var sceneLabel = document.getElementById('sceneLabel');
  var sceneProgressFill = document.getElementById('sceneProgressFill');
  var npcEmoji = document.getElementById('npcEmoji');
  var npcNameTag = document.getElementById('npcNameTag');
  var dialogueText = document.getElementById('dialogueText');
  var npcReaction = document.getElementById('npcReaction');
  var npcReactionText = document.getElementById('npcReactionText');
  var choicesArea = document.getElementById('choicesArea');
  var choicesContainer = document.getElementById('choicesContainer');
  var continuePrompt = document.getElementById('continuePrompt');

  // Result elements
  var resultPortrait = document.getElementById('resultPortrait');
  var resultTierName = document.getElementById('resultTierName');
  var resultTagline = document.getElementById('resultTagline');
  var meterFill = document.getElementById('meterFill');
  var meterScore = document.getElementById('meterScore');
  var resultDescription = document.getElementById('resultDescription');
  var resultTraits = document.getElementById('resultTraits');
  var rolePreviewItems = document.querySelectorAll('[data-preview-tier]');
  var relatedGrid = document.getElementById('related-grid');
  var primaryRelatedEmoji = document.getElementById('primary-related-emoji');
  var primaryRelatedTitle = document.getElementById('primary-related-title');
  var primaryRelatedDesc = document.getElementById('primary-related-desc');
  var primaryRelatedCta = document.getElementById('primary-related-cta');
  var primaryRelatedCtaText = document.getElementById('primary-related-cta-text');
  var relatedJumpBtn = document.getElementById('related-jump-btn');
  var resultInlineAd = document.getElementById('result-inline-ad');

  // Share elements
  var shareBtn = document.getElementById('shareBtn');
  var retryBtn = document.getElementById('retryBtn');
  var shareModal = document.getElementById('shareModal');
  var shareClose = document.getElementById('shareClose');
  var shareTwitter = document.getElementById('shareTwitter');
  var shareFacebook = document.getElementById('shareFacebook');
  var shareCopy = document.getElementById('shareCopy');
  var themeToggle = document.getElementById('themeToggle');
  var recommendationMap = {
    npc: ['attachment-style', 'eq-test', 'rizz-score', 'villain-type'],
    extra: ['eq-test', 'attachment-style', 'rizz-score', 'villain-type'],
    side: ['rizz-score', 'eq-test', 'attachment-style', 'villain-type'],
    main: ['eq-test', 'rizz-score', 'villain-type', 'attachment-style'],
    boss: ['villain-type', 'eq-test', 'rizz-score', 'attachment-style']
  };

  // i18n helper
  function t(key, fallback) {
    try {
      if (window.i18n && window.i18n.loaded) {
        return window.i18n.t(key, fallback);
      }
    } catch (e) {
      // silent
    }
    return fallback || key;
  }

  function trackEvent(name, params) {
    if (typeof gtag === 'function') {
      gtag('event', name, params || {});
    }
  }

  function getCurrentLang() {
    if (window.i18n && window.i18n.lang) {
      return window.i18n.lang;
    }
    return document.documentElement.lang || 'ko';
  }

  function updateRolePreview() {
    if (!rolePreviewItems.length) return;
    for (var i = 0; i < rolePreviewItems.length; i++) {
      var item = rolePreviewItems[i];
      var tierKey = item.getAttribute('data-preview-tier');
      var tierMeta = TIERS.find(function(tier) { return tier.key === tierKey; });
      if (!tierMeta) continue;
      item.textContent = tierMeta.emoji + ' ' + t('tiers.' + tierKey + '.name', tierKey);
    }
  }

  function prioritizeRelatedCards(tierKey) {
    if (!relatedGrid) return;

    var cards = Array.prototype.slice.call(relatedGrid.querySelectorAll('.related-card'));
    var order = recommendationMap[tierKey] || recommendationMap.side;
    var rankMap = {};

    order.forEach(function(key, index) {
      rankMap[key] = index;
    });

    cards.sort(function(a, b) {
      var aKey = a.getAttribute('data-related-key') || '';
      var bKey = b.getAttribute('data-related-key') || '';
      var aRank = Object.prototype.hasOwnProperty.call(rankMap, aKey) ? rankMap[aKey] : 999;
      var bRank = Object.prototype.hasOwnProperty.call(rankMap, bKey) ? rankMap[bKey] : 999;
      return aRank - bRank;
    });

    cards.forEach(function(card, index) {
      card.classList.toggle('is-featured', index < 2);
      card.setAttribute('data-rank', String(index + 1));
      relatedGrid.appendChild(card);
    });
  }

  function updatePrimaryRecommendation() {
    if (!relatedGrid || !primaryRelatedTitle || !primaryRelatedDesc || !primaryRelatedCta || !primaryRelatedCtaText || !primaryRelatedEmoji) {
      return;
    }

    var firstCard = relatedGrid.querySelector('.related-card');
    if (!firstCard) return;

    var titleEl = firstCard.querySelector('.related-name');
    var emojiEl = firstCard.querySelector('.related-emoji');
    var cardTitle = titleEl ? titleEl.textContent.trim() : 'Recommended Test';
    var cardColor = firstCard.style.getPropertyValue('--card-color') || '';
    var nextStepCard = document.getElementById('next-step-card');

    primaryRelatedTitle.textContent = cardTitle;
    primaryRelatedDesc.textContent = t('result.nextStepDesc', 'Your result unlocked the strongest next route. Take it before the quest moves on.');
    primaryRelatedCtaText.textContent = t('result.nextStepCta', 'Open Best Match');
    primaryRelatedEmoji.textContent = emojiEl ? emojiEl.textContent.trim() : '->';
    primaryRelatedCta.setAttribute('href', firstCard.getAttribute('href') || '#');
    primaryRelatedCta.setAttribute('data-related-key', firstCard.getAttribute('data-related-key') || '');
    primaryRelatedCta.setAttribute('data-related-rank', firstCard.getAttribute('data-rank') || '1');

    if (cardColor) {
      if (nextStepCard) {
        nextStepCard.style.setProperty('--cta-color', cardColor);
      }
      primaryRelatedCta.style.setProperty('--cta-color', cardColor);
    }
  }

  function ensureResultAdLoaded() {
    if (resultInlineAdLoaded || !resultInlineAd) return;
    var adNode = resultInlineAd.querySelector('.adsbygoogle');
    if (!adNode) return;

    try {
      (adsbygoogle = window.adsbygoogle || []).push({});
      resultInlineAdLoaded = true;
    } catch (error) {
      // Ad blockers or delayed AdSense init are non-fatal.
    }
  }

  // Theme
  function initTheme() {
    var saved = localStorage.getItem('npc-test-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }

  function hideAppLoader() {
    const appLoader = document.getElementById('app-loader');
    if (appLoader) appLoader.classList.add('hidden');
  }

  themeToggle.addEventListener('click', function() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('npc-test-theme', next);
  });

  // Screen transitions
  function showScreen(screen) {
    [introScreen, dialogueScreen, resultScreen].forEach(function(s) {
      s.classList.remove('active');
    });
    screen.classList.add('active');
    window.scrollTo(0, 0);
  }

  // Typing effect
  function typeText(element, text, speed, callback) {
    isTyping = true;
    element.innerHTML = '';
    var i = 0;
    var cursor = document.createElement('span');
    cursor.className = 'typing-cursor';

    function typeChar() {
      if (i < text.length) {
        // Remove cursor before adding char
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        element.textContent = text.substring(0, i + 1);
        element.appendChild(cursor);
        i++;
        typingTimeout = setTimeout(typeChar, speed);
      } else {
        // Done typing - remove cursor
        if (cursor.parentNode) cursor.parentNode.removeChild(cursor);
        isTyping = false;
        if (callback) callback();
      }
    }

    typeChar();
  }

  // Skip typing and show full text immediately
  function skipTyping(element, text, callback) {
    if (typingTimeout) clearTimeout(typingTimeout);
    isTyping = false;
    element.textContent = text;
    if (callback) callback();
  }

  // Get tier from percentage
  function getTier(percent) {
    for (var i = TIERS.length - 1; i >= 0; i--) {
      if (percent >= TIERS[i].min) return TIERS[i];
    }
    return TIERS[0];
  }

  // Start
  startBtn.addEventListener('click', function() {
    currentScene = 0;
    totalRawScore = 0;
    resultTier = null;
    currentPercentile = null;
    showScreen(dialogueScreen);
    renderScene();
    trackEvent('quiz_start', {
      event_category: 'npc_test',
      event_label: getCurrentLang(),
      value: TOTAL_SCENES
    });
  });

  // Render a scene
  function renderScene() {
    var sceneKey = 'scenes.s' + (currentScene + 1);

    // Update progress
    var pct = (currentScene / TOTAL_SCENES) * 100;
    sceneProgressFill.style.width = pct + '%';
    sceneLabel.textContent = (window.i18n?.t('game.scene') || 'SCENE') + ' ' + (currentScene + 1) + '/' + TOTAL_SCENES;

    // Set NPC portrait
    npcEmoji.textContent = NPC_EMOJIS[currentScene];
    npcNameTag.textContent = t(sceneKey + '.npc', 'NPC');

    // Hide reaction and continue prompt
    npcReaction.classList.remove('visible');
    continuePrompt.classList.remove('visible');

    // Show choices area
    choicesArea.style.display = 'block';

    // Get NPC dialogue
    var npcLine = t(sceneKey + '.line', 'The NPC speaks...');

    // Type the dialogue text, then show choices
    var choicesShown = false;
    typeText(dialogueText, npcLine, 30, function() {
      if (!choicesShown) {
        choicesShown = true;
        showChoices(sceneKey);
      }
    });

    // Allow clicking to skip typing
    var skipHandler = function() {
      if (isTyping) {
        choicesShown = true;
        skipTyping(dialogueText, npcLine, function() {
          showChoices(sceneKey);
        });
      }
    };

    // Remove old handler and add new
    dialogueText.onclick = skipHandler;

    // Clear choices while typing
    choicesContainer.innerHTML = '';
  }

  // Show choices for current scene
  function showChoices(sceneKey) {
    choicesContainer.innerHTML = '';

    // Determine number of choices (2 or 3)
    var choiceKeys = ['a', 'b', 'c'];
    var choices = [];

    choiceKeys.forEach(function(key) {
      var text = t(sceneKey + '.choices.' + key, '');
      if (text && text !== sceneKey + '.choices.' + key) {
        choices.push({ key: key, text: text });
      }
    });

    // Points mapping per choice
    var pointsMap = { a: 0, b: 1, c: 2 };
    // For 2-choice scenes
    if (choices.length === 2) {
      pointsMap = { a: 0, b: 3 };
    }
    // For 3-choice scenes use: a=0, b=1, c=3
    if (choices.length === 3) {
      pointsMap = { a: 0, b: 1, c: 3 };
    }

    choices.forEach(function(choice) {
      var btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = choice.text;
      btn.addEventListener('click', function() {
        selectChoice(choice.key, pointsMap[choice.key], btn, sceneKey);
      });
      choicesContainer.appendChild(btn);
    });
  }

  // Handle choice selection
  function selectChoice(choiceKey, points, btnEl, sceneKey) {
    // Visual feedback
    btnEl.classList.add('selected');

    // Disable all buttons
    var allBtns = choicesContainer.querySelectorAll('.choice-btn');
    for (var i = 0; i < allBtns.length; i++) {
      allBtns[i].disabled = true;
    }

    totalRawScore += points;
    trackEvent('npc_choice_select', {
      event_category: 'npc_test',
      scene_number: currentScene + 1,
      scene_key: sceneKey,
      choice_key: choiceKey,
      choice_points: points
    });

    // Show NPC reaction
    var reactionText = t(sceneKey + '.reactions.' + choiceKey, '');
    if (reactionText && reactionText !== sceneKey + '.reactions.' + choiceKey) {
      npcReactionText.textContent = '';
      npcReaction.classList.add('visible');
      // Hide choices area to make room
      choicesArea.style.display = 'none';

      typeText(npcReactionText, reactionText, 25, function() {
        showContinuePrompt();
      });

      // Allow skip on reaction too
      npcReactionText.onclick = function() {
        if (isTyping) {
          skipTyping(npcReactionText, reactionText, function() {
            showContinuePrompt();
          });
        }
      };
    } else {
      // No reaction, just proceed
      setTimeout(function() {
        advanceScene();
      }, 500);
    }
  }

  // Show continue prompt
  function showContinuePrompt() {
    continuePrompt.classList.add('visible');

    continuePrompt.onclick = function() {
      continuePrompt.classList.remove('visible');
      trackEvent('npc_continue_click', {
        event_category: 'npc_test',
        scene_number: currentScene + 1
      });
      advanceScene();
    };
  }

  // Advance to next scene or result
  function advanceScene() {
    currentScene++;
    if (currentScene >= TOTAL_SCENES) {
      showResult();
    } else {
      renderScene();
    }
  }

  // Animate counter
  function animateCounter(target, duration, callback) {
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var current = Math.round(eased * target);
      callback(current);
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  // Show result
  function showResult() {
    finalPercent = Math.round((totalRawScore / MAX_RAW_SCORE) * 100);
    if (finalPercent > 100) finalPercent = 100;

    resultTier = getTier(finalPercent);
    var tierKey = 'tiers.' + resultTier.key;
    currentPercentile = currentPercentile || (Math.floor(Math.random() * 15) + 3);
    prioritizeRelatedCards(resultTier.key);
    updatePrimaryRecommendation();

    // Progress full
    sceneProgressFill.style.width = '100%';

    showScreen(resultScreen);

    // Portrait
    resultPortrait.textContent = resultTier.emoji;

    // Tier name
    resultTierName.textContent = t(tierKey + '.name', resultTier.key);

    // Tagline
    var tagline = t(tierKey + '.tagline', '');
    resultTagline.textContent = tagline ? '"' + tagline + '"' : '';

    // Description
    resultDescription.textContent = t(tierKey + '.desc', '');

    // Traits
    resultTraits.innerHTML = '';
    try {
      if (window.i18n && window.i18n.loaded) {
        var traitsData = window.i18n.t(tierKey + '.traits');
        if (Array.isArray(traitsData)) {
          traitsData.forEach(function(trait) {
            var tag = document.createElement('span');
            tag.className = 'trait-tag';
            tag.textContent = trait;
            resultTraits.appendChild(tag);
          });
        }
      }
    } catch (e) {
      // silent
    }

    // Animate meter
    meterFill.style.width = '0%';
    meterScore.textContent = '0%';

    setTimeout(function() {
      meterFill.style.width = finalPercent + '%';
      animateCounter(finalPercent, 1800, function(val) {
        meterScore.textContent = val + '%';
      });
    }, 300);

    // Percentile stat
    var percentileEl = document.getElementById('percentile-stat');
    if (percentileEl) {
      var pText = t('result.percentileStat', 'Only <strong>{percent}%</strong> of players got the same RPG role');
      percentileEl.innerHTML = pText.replace('{percent}', currentPercentile);
    }

    // GA4
    trackEvent('result_view', {
      event_category: 'npc_test',
      event_label: resultTier.key,
      value: finalPercent
    });
    trackEvent('quiz_complete', {
      event_category: 'npc_test',
      event_label: resultTier.key,
      value: finalPercent
    });
    ensureResultAdLoaded();
  }

  // Retry
  retryBtn.addEventListener('click', function() {
    trackEvent('npc_retry_click', {
      event_category: 'npc_test',
      event_label: resultTier ? resultTier.key : 'unknown',
      value: finalPercent
    });
    currentScene = 0;
    totalRawScore = 0;
    finalPercent = 0;
    resultTier = null;
    currentPercentile = null;
    meterFill.style.width = '0%';
    meterScore.textContent = '0%';
    showScreen(introScreen);
  });

  // Share modal
  shareBtn.addEventListener('click', function() {
    shareModal.classList.add('active');
    trackEvent('npc_share_open', {
      event_category: 'npc_test',
      event_label: resultTier ? resultTier.key : ''
    });
  });

  shareClose.addEventListener('click', function() {
    shareModal.classList.remove('active');
  });

  shareModal.addEventListener('click', function(e) {
    if (e.target === shareModal) {
      shareModal.classList.remove('active');
    }
  });

  function getShareText() {
    if (!resultTier) return '';
    var name = t('tiers.' + resultTier.key + '.name', resultTier.key);
    var shareText = t('share.text', 'I scored {score}% on the NPC Test - I\'m {type}!');
    return resultTier.emoji + ' ' + shareText.replace('{score}', finalPercent).replace('{type}', name);
  }

  function getShareUrl() {
    var url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('lang', getCurrentLang());
    return url.toString();
  }

  shareTwitter.addEventListener('click', function() {
    var text = encodeURIComponent(getShareText());
    var url = encodeURIComponent(getShareUrl());
    window.open('https://twitter.com/intent/tweet?text=' + text + '&url=' + url, '_blank', 'noopener');
    trackEvent('share', { method: 'twitter', content_type: 'quiz_result' });
    trackEvent('npc_share_click', {
      event_category: 'npc_test',
      method: 'twitter',
      event_label: resultTier ? resultTier.key : ''
    });
  });

  shareFacebook.addEventListener('click', function() {
    var url = encodeURIComponent(getShareUrl());
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + url, '_blank', 'noopener');
    trackEvent('share', { method: 'facebook', content_type: 'quiz_result' });
    trackEvent('npc_share_click', {
      event_category: 'npc_test',
      method: 'facebook',
      event_label: resultTier ? resultTier.key : ''
    });
  });

  shareCopy.addEventListener('click', function() {
    var text = getShareText() + '\n' + getShareUrl();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function() {
        showToast(t('share.copied', 'Copied!'));
      }).catch(function() {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
    trackEvent('share', { method: 'copy', content_type: 'quiz_result' });
    trackEvent('npc_share_click', {
      event_category: 'npc_test',
      method: 'copy',
      event_label: resultTier ? resultTier.key : ''
    });
  });

  if (primaryRelatedCta) {
    primaryRelatedCta.addEventListener('click', function() {
      trackEvent('npc_primary_cta_click', {
        event_category: 'npc_test',
        event_label: this.getAttribute('data-related-key') || this.getAttribute('href'),
        result_tier: resultTier ? resultTier.key : 'unknown',
        related_rank: this.getAttribute('data-related-rank') || '1'
      });
    });
  }

  if (relatedJumpBtn) {
    relatedJumpBtn.addEventListener('click', function() {
      var relatedSection = document.querySelector('.related-tests');
      if (relatedSection) {
        relatedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      trackEvent('npc_related_jump_click', {
        event_category: 'npc_test',
        event_label: resultTier ? resultTier.key : 'unknown'
      });
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showToast(t('share.copied', 'Copied!'));
    } catch (e) {
      showToast(t('share.copyFail', 'Copy failed'));
    }
    document.body.removeChild(ta);
  }

  // Toast
  function showToast(msg) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    requestAnimationFrame(function() {
      toast.classList.add('show');
    });

    setTimeout(function() {
      toast.classList.remove('show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 2000);
  }

  // Language change handler
  window.addEventListener('langchange', function() {
    updateRolePreview();
    if (resultScreen.classList.contains('active') && resultTier) {
      setTimeout(function() {
        var tierKey = 'tiers.' + resultTier.key;
        resultTierName.textContent = t(tierKey + '.name', resultTier.key);
        var tagline = t(tierKey + '.tagline', '');
        resultTagline.textContent = tagline ? '"' + tagline + '"' : '';
        resultDescription.textContent = t(tierKey + '.desc', '');

        resultTraits.innerHTML = '';
        try {
          var traitsData = window.i18n.t(tierKey + '.traits');
          if (Array.isArray(traitsData)) {
            traitsData.forEach(function(trait) {
              var tag = document.createElement('span');
              tag.className = 'trait-tag';
              tag.textContent = trait;
              resultTraits.appendChild(tag);
            });
          }
        } catch (e) {
          // silent
        }
        var percentileEl = document.getElementById('percentile-stat');
        if (percentileEl && currentPercentile) {
          var pText = t('result.percentileStat', 'Only <strong>{percent}%</strong> of players got the same RPG role');
          percentileEl.innerHTML = pText.replace('{percent}', currentPercentile);
        }
        prioritizeRelatedCards(resultTier.key);
        updatePrimaryRecommendation();
      }, 200);
    } else if (dialogueScreen.classList.contains('active')) {
      renderScene();
    }
  });

  if (relatedGrid) {
    relatedGrid.addEventListener('click', function(event) {
      var card = event.target.closest('.related-card');
      if (!card) return;
      trackEvent('npc_related_click', {
        event_category: 'npc_test',
        event_label: card.getAttribute('data-related-key') || card.getAttribute('href'),
        result_tier: resultTier ? resultTier.key : 'unknown',
        related_rank: card.getAttribute('data-rank') || ''
      });
    });
  }

  // Init
  initTheme();
  updateRolePreview();
  hideAppLoader();
  window.setTimeout(updateRolePreview, 300);

})();

/* NPC Test - Are You an NPC or the Main Character? */
(function() {
  'use strict';

  // 12 questions, each with 4 options scored 0-3
  // Total max raw score: 36, mapped to 0-100%
  var QUESTIONS = [
    { key: 'q1', points: [0, 1, 2, 3] },
    { key: 'q2', points: [0, 1, 2, 3] },
    { key: 'q3', points: [0, 1, 2, 3] },
    { key: 'q4', points: [0, 1, 2, 3] },
    { key: 'q5', points: [0, 1, 2, 3] },
    { key: 'q6', points: [0, 1, 2, 3] },
    { key: 'q7', points: [0, 1, 2, 3] },
    { key: 'q8', points: [0, 1, 2, 3] },
    { key: 'q9', points: [0, 1, 2, 3] },
    { key: 'q10', points: [0, 1, 2, 3] },
    { key: 'q11', points: [0, 1, 2, 3] },
    { key: 'q12', points: [0, 1, 2, 3] }
  ];

  var TOTAL_QUESTIONS = QUESTIONS.length;
  var MAX_RAW_SCORE = 36;

  // 5 result tiers
  var TIERS = [
    { key: 'npc',   icon: '\uD83E\uDD16', min: 0,  max: 20, cssClass: 'tier-npc' },
    { key: 'extra', icon: '\uD83D\uDC7B', min: 21, max: 40, cssClass: 'tier-extra' },
    { key: 'side',  icon: '\u26A1',        min: 41, max: 60, cssClass: 'tier-side' },
    { key: 'main',  icon: '\uD83D\uDC51', min: 61, max: 80, cssClass: 'tier-main' },
    { key: 'boss',  icon: '\uD83D\uDD25', min: 81, max: 100, cssClass: 'tier-boss' }
  ];

  // Option keys for each question
  var OPTION_KEYS = ['a', 'b', 'c', 'd'];

  // State
  var currentQuestion = 0;
  var totalRawScore = 0;
  var finalPercent = 0;
  var resultTier = null;

  // DOM elements
  var introScreen = document.getElementById('intro');
  var quizScreen = document.getElementById('quiz');
  var resultScreen = document.getElementById('result');
  var startBtn = document.getElementById('startBtn');
  var progressFill = document.getElementById('progressFill');
  var progressText = document.getElementById('progressText');
  var questionText = document.getElementById('questionText');
  var optionsContainer = document.getElementById('optionsContainer');
  var meterFill = document.getElementById('meterFill');
  var meterIndicator = document.getElementById('meterIndicator');
  var meterScore = document.getElementById('meterScore');
  var tierIcon = document.getElementById('tierIcon');
  var resultTierName = document.getElementById('resultTierName');
  var resultTagline = document.getElementById('resultTagline');
  var resultDescription = document.getElementById('resultDescription');
  var resultTraits = document.getElementById('resultTraits');
  var shareBtn = document.getElementById('shareBtn');
  var retryBtn = document.getElementById('retryBtn');
  var shareModal = document.getElementById('shareModal');
  var shareClose = document.getElementById('shareClose');
  var shareTwitter = document.getElementById('shareTwitter');
  var shareFacebook = document.getElementById('shareFacebook');
  var shareCopy = document.getElementById('shareCopy');
  var themeToggle = document.getElementById('themeToggle');

  // i18n helper with try-catch
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

  // Theme toggle
  function initTheme() {
    var saved = localStorage.getItem('npc-test-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
    }
  }

  themeToggle.addEventListener('click', function() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('npc-test-theme', next);
  });

  // Screen transitions
  function showScreen(screen) {
    [introScreen, quizScreen, resultScreen].forEach(function(s) {
      s.classList.remove('active');
    });
    screen.classList.add('active');
    window.scrollTo(0, 0);
  }

  // Get tier from percentage
  function getTier(percent) {
    for (var i = TIERS.length - 1; i >= 0; i--) {
      if (percent >= TIERS[i].min) {
        return TIERS[i];
      }
    }
    return TIERS[0];
  }

  // Start quiz
  startBtn.addEventListener('click', function() {
    currentQuestion = 0;
    totalRawScore = 0;
    showScreen(quizScreen);
    renderQuestion();

    // GA4 event
    if (typeof gtag === 'function') {
      gtag('event', 'quiz_start', { event_category: 'npc_test' });
    }
  });

  // Render question
  function renderQuestion() {
    var q = QUESTIONS[currentQuestion];
    var qKey = 'quiz.' + q.key;

    // Update progress
    var pct = (currentQuestion / TOTAL_QUESTIONS) * 100;
    progressFill.style.width = pct + '%';
    progressText.textContent = (currentQuestion + 1) + ' / ' + TOTAL_QUESTIONS;

    // Question text
    questionText.textContent = t(qKey + '.question', 'Question ' + (currentQuestion + 1));

    // Options
    optionsContainer.innerHTML = '';
    OPTION_KEYS.forEach(function(key, idx) {
      var btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.textContent = t(qKey + '.' + key, 'Option ' + (idx + 1));
      btn.addEventListener('click', function() {
        selectOption(q.points[idx], btn);
      });
      optionsContainer.appendChild(btn);
    });
  }

  // Select option
  function selectOption(points, btnEl) {
    // Visual feedback
    btnEl.classList.add('selected');

    // Disable all buttons
    var allBtns = optionsContainer.querySelectorAll('.option-btn');
    for (var i = 0; i < allBtns.length; i++) {
      allBtns[i].disabled = true;
    }

    totalRawScore += points;
    currentQuestion++;

    setTimeout(function() {
      if (currentQuestion >= TOTAL_QUESTIONS) {
        showResult();
      } else {
        renderQuestion();
      }
    }, 400);
  }

  // Animate score counter
  function animateCounter(target, duration, callback) {
    var start = 0;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
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
    // Calculate percentage
    finalPercent = Math.round((totalRawScore / MAX_RAW_SCORE) * 100);
    if (finalPercent > 100) finalPercent = 100;

    resultTier = getTier(finalPercent);
    var tierKey = 'results.' + resultTier.key;

    // Progress bar full
    progressFill.style.width = '100%';

    // Show result screen
    showScreen(resultScreen);

    // Tier icon
    tierIcon.className = 'tier-icon ' + resultTier.cssClass;
    tierIcon.textContent = resultTier.icon;

    // Tier name
    resultTierName.textContent = t(tierKey + '.name', resultTier.key);

    // Tagline
    resultTagline.textContent = '"' + t(tierKey + '.tagline', '') + '"';

    // Description
    resultDescription.textContent = t(tierKey + '.description', '');

    // Traits
    resultTraits.innerHTML = '';
    var traits = [];
    try {
      if (window.i18n && window.i18n.loaded) {
        var traitsData = window.i18n.t(tierKey + '.traits');
        if (Array.isArray(traitsData)) traits = traitsData;
      }
    } catch (e) {
      // silent
    }
    traits.forEach(function(trait) {
      var tag = document.createElement('span');
      tag.className = 'trait-tag';
      tag.textContent = trait;
      resultTraits.appendChild(tag);
    });

    // Animate NPC meter
    meterFill.style.width = '0%';
    meterIndicator.style.left = '0%';
    meterScore.textContent = '0%';

    setTimeout(function() {
      meterFill.style.width = finalPercent + '%';
      meterIndicator.style.left = finalPercent + '%';

      // Animate counter
      animateCounter(finalPercent, 1800, function(val) {
        meterScore.textContent = val + '%';
      });
    }, 300);

    // GA4 event
    if (typeof gtag === 'function') {
      gtag('event', 'quiz_complete', {
        event_category: 'npc_test',
        event_label: resultTier.key,
        value: finalPercent
      });
    }
  }

  // Retry
  retryBtn.addEventListener('click', function() {
    currentQuestion = 0;
    totalRawScore = 0;
    finalPercent = 0;
    resultTier = null;
    meterFill.style.width = '0%';
    meterIndicator.style.left = '0%';
    meterScore.textContent = '0%';
    showScreen(introScreen);
  });

  // Share modal
  shareBtn.addEventListener('click', function() {
    shareModal.classList.add('active');
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
    var name = t('results.' + resultTier.key + '.name', resultTier.key);
    var shareText = t('share.text', 'I scored {score}% on the NPC Test - I\'m {type}!');
    return resultTier.icon + ' ' + shareText.replace('{score}', finalPercent).replace('{type}', name);
  }

  function getShareUrl() {
    return 'https://dopabrain.com/npc-test/';
  }

  shareTwitter.addEventListener('click', function() {
    var text = encodeURIComponent(getShareText());
    var url = encodeURIComponent(getShareUrl());
    window.open('https://twitter.com/intent/tweet?text=' + text + '&url=' + url, '_blank', 'noopener');
    if (typeof gtag === 'function') {
      gtag('event', 'share', { method: 'twitter', content_type: 'quiz_result' });
    }
  });

  shareFacebook.addEventListener('click', function() {
    var url = encodeURIComponent(getShareUrl());
    window.open('https://www.facebook.com/sharer/sharer.php?u=' + url, '_blank', 'noopener');
    if (typeof gtag === 'function') {
      gtag('event', 'share', { method: 'facebook', content_type: 'quiz_result' });
    }
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
    if (typeof gtag === 'function') {
      gtag('event', 'share', { method: 'copy', content_type: 'quiz_result' });
    }
  });

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

  // Listen for language change to re-render current state
  window.addEventListener('langchange', function() {
    if (resultScreen.classList.contains('active') && resultTier) {
      // Re-render result text
      setTimeout(function() {
        var tierKey = 'results.' + resultTier.key;
        resultTierName.textContent = t(tierKey + '.name', resultTier.key);
        resultTagline.textContent = '"' + t(tierKey + '.tagline', '') + '"';
        resultDescription.textContent = t(tierKey + '.description', '');

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
      }, 200);
    } else if (quizScreen.classList.contains('active')) {
      renderQuestion();
    }
  });

  // Init
  initTheme();

})();

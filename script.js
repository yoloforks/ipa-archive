var rawApps = [];
var apps = [];
var baseUrls = {};
var appsLoaded = false;
var PER_PAGE = 30;
var currentPage = 0;
var currentFiltered = [];

var searchInput = document.getElementById('searchInput');
var bundleInput = document.getElementById('bundleid');
var minosInput = document.getElementById('minos');
var maxosInput = document.getElementById('maxos');
var deviceSelect = document.getElementById('device');
var uniqueCheck = document.getElementById('unique');
var resultsContainer = document.getElementById('resultsContainer');
var searchResults = document.getElementById('searchResults');
var emptyState = document.getElementById('searchEmptyState');
var modalContainer = document.getElementById('modalContainer');

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatOS(min_os) {
  if (!min_os) return 'Unknown';
  var major = Math.floor(min_os / 10000);
  var minor = Math.floor((min_os % 10000) / 100);
  var patch = min_os % 100;
  if (patch > 0) return major + '.' + minor + '.' + patch;
  return major + '.' + minor;
}

function parseVersion(v) {
  if (!v) return 0;
  var parts = String(v).split('.').map(function(x) {
    return parseInt(x) || 0;
  });
  return (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
}

function getPlatformIcons(platform) {
  if (!platform) return '';
  var icons = [];
  if (platform & (1 << 1)) icons.push('<span class="device-icon" title="iPhone"><i class="fa-solid fa-mobile-screen-button"></i></span>');
  if (platform & (1 << 2)) icons.push('<span class="device-icon" title="iPad"><i class="fa-solid fa-tablet-screen-button"></i></span>');
  if (platform & (1 << 3)) icons.push('<span class="device-icon" title="Apple TV"><i class="fa-solid fa-tv"></i></span>');
  if (platform & (1 << 4)) icons.push('<span class="device-icon" title="Apple Watch"><i class="fa-solid fa-watch"></i></span>');
  return '<span class="device-icons">' + icons.join('') + '</span>';
}

function getImgPath(image_pk) {
  if (!image_pk) return null;
  return 'data/' + Math.floor(image_pk / 1000) + '/' + image_pk + '.jpg';
}

var plistServerUrl = '';
try {
  plistServerUrl = localStorage.getItem('plistServerUrl') || '';
} catch (e) {
  plistServerUrl = '';
}

function getAppUrl(app_version) {
  var baseUrl = baseUrls[app_version.base_url_id] || '';
  return baseUrl + '/' + app_version.path;
}

function fetchJSON(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        try {
          callback(null, JSON.parse(xhr.responseText));
        } catch (e) {
          callback(e, null);
        }
      } else {
        callback(new Error('HTTP ' + xhr.status), null);
      }
    }
  };
  xhr.send();
}

function fetchAppsData(callback) {
  var statsBar = document.getElementById('statsBar');
  var urlsData = null;
  var ipaData = null;
  var errors = 0;
  var done = 0;

  function onBothDone() {
    done++;
    if (done < 2) return;
    if (errors > 0) {
      callback(new Error('Failed to load data'));
      return;
    }

    baseUrls = urlsData;
    rawApps = ipaData;

    apps = rawApps.map(function(row) {
      return {
        pk: row[0],
        platform: row[1],
        min_os: row[2],
        title: row[3] || 'Untitled App',
        bundle_id: row[4] || '',
        version: row[5],
        base_url_id: row[6],
        path: row[7].replace(/##/g, '/'),
        fsize: row[8],
        image_pk: row[9],
        icon: getImgPath(row[9]),
        developer: row[4]
          ? row[4].split('.').slice(0, 2).join('.')
          : 'Archive'
      };
    });

    var uniqueBids = {};
    apps.forEach(function(a) {
      uniqueBids[a.bundle_id || a.title] = true;
    });

    var uniqueCount = 0;
    for (var k in uniqueBids) {
      if (uniqueBids.hasOwnProperty(k)) {
        uniqueCount++;
      }
    }

    if (statsBar) {
      statsBar.textContent = apps.length.toLocaleString() + ' IPAs | ' + uniqueCount.toLocaleString() + ' Apps';
    }

    appsLoaded = true;
    callback(null);
  }

  fetchJSON('data/urls.json', function(err, data) {
    if (err) errors++;
    else urlsData = data;
    onBothDone();
  });

  fetchJSON('data/ipa.json', function(err, data) {
    if (err) errors++;
    else ipaData = data;
    onBothDone();
  });
}

function renderAppTitle(app) {
  return escapeHtml(app && app.title);
}

function renderAppTitleWithDevices(app) {
  return escapeHtml(app && app.title) + getPlatformIcons(app && app.platform);
}

function getFilteredApps() {
  var q = searchInput.value.toLowerCase().replace(/^\s+|\s+$/g, '');
  var bid = bundleInput.value.toLowerCase().replace(/^\s+|\s+$/g, '');
  var min = parseVersion(minosInput.value);
  var max = parseVersion(maxosInput.value) || 999999;
  var devValue = deviceSelect.value;
  var dev = devValue ? parseInt(devValue) : 0;
  var unique = uniqueCheck.checked;

  var filtered = apps.filter(function(app) {
    if (q && !(app.title.toLowerCase().indexOf(q) !== -1 || app.path.toLowerCase().indexOf(q) !== -1)) return false;
    if (bid && app.bundle_id.toLowerCase().indexOf(bid) === -1) return false;
    if (min && app.min_os < min) return false;
    if (max && app.min_os > max) return false;
    if (dev && !(app.platform & dev)) return false;
    return true;
  });

  if (unique) {
    var seen = {};
    filtered.forEach(function(app) {
      var key = app.bundle_id || app.title;
      if (!seen[key] || app.min_os > seen[key].min_os) {
        seen[key] = app;
      }
    });
    var result = [];
    for (var k in seen) {
      if (seen.hasOwnProperty(k)) {
        result.push(seen[k]);
      }
    }
    filtered = result;
  }
  return filtered;
}

function applyFilters(page) {
  page = page || 0;
  if (!appsLoaded) return;
  currentPage = page;
  currentFiltered = getFilteredApps();

  var countDiv = document.getElementById('searchResultCount');
  if (countDiv) {
    if (currentFiltered.length > 0) {
      var startRange = (currentPage * PER_PAGE) + 1;
      var endRange = Math.min((currentPage + 1) * PER_PAGE, currentFiltered.length);
      countDiv.textContent = 'Showing ' + startRange.toLocaleString() + '-' + endRange.toLocaleString() + ' of ' + currentFiltered.length.toLocaleString() + ' results';
      countDiv.style.display = 'block';
    } else {
      countDiv.style.display = 'none';
    }
  }

  searchResults.classList.remove('results-fade-in');
  void searchResults.offsetWidth;
  searchResults.classList.add('results-fade-in');

  renderGrid(currentFiltered, currentPage);
  renderPagination(currentFiltered.length, currentPage);
  saveConfig();
}

function smoothScroll() {
  resultsContainer.scrollIntoView({ behavior: 'smooth' });
}

function renderPagination(total, page) {
  var nav = document.getElementById('pagination');
  var totalPages = Math.ceil(total / PER_PAGE);
  nav.innerHTML = '';
  if (totalPages <= 1) return;

  var wrap = document.createElement('div');
  wrap.className = 'pagination-wrap';

  var range = 2;
  var start = Math.max(0, page - range);
  var end = Math.min(totalPages - 1, page + range);

  if (page > 0) {
    var prev = document.createElement('button');
    prev.innerHTML = '&laquo;';
    prev.onclick = function() {
      applyFilters(page - 1);
      smoothScroll();
    };
    wrap.appendChild(prev);
  }

  for (var i = start; i <= end; i++) {
    var btn = document.createElement('button');
    btn.textContent = i + 1;
    if (i === page) btn.className = 'active';
    btn.onclick = function() {
      applyFilters(i);
      smoothScroll();
    };
    wrap.appendChild(btn);
  }

  if (page < totalPages - 1) {
    var next = document.createElement('button');
    next.innerHTML = '&raquo;';
    next.onclick = function() {
      applyFilters(page + 1);
      smoothScroll();
    };
    wrap.appendChild(next);
  }

  nav.appendChild(wrap);
}

function randomIPA() {
  if (!appsLoaded) return;
  searchInput.value = '';
  bundleInput.value = '';
  currentPage = 0;
  saveConfig();

  var filteredPool = getFilteredApps();
  if (filteredPool.length === 0) {
    alert('No apps match your current filters. Try changing the OS or Device settings.');
    return;
  }

  var countSelect = document.getElementById('randomCountSelect');
  var count = Math.min(parseInt(countSelect.value), filteredPool.length);

  var selected = filteredPool.slice(0, count);
  for (var i = count; i < filteredPool.length; i++) {
    var j = Math.floor(Math.random() * (i + 1));
    if (j < count) {
      selected[j] = filteredPool[i];
    }
  }

  searchResults.innerHTML = '';
  emptyState.style.display = 'none';
  document.getElementById('pagination').innerHTML = '';

  var container = document.createDocumentFragment();
  selected.forEach(function(app) {
    var card = document.createElement('div');
    card.className = 'app-card-grid-aesthetic';
    card.innerHTML =
      '<div class="card-icon-glossy">' +
        (app.icon
          ? '<img src="' + app.icon + '" alt="' + escapeHtml(app.title) + '" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<i class=\\\'fas fa-mobile-alt\\\'></i>\'">'
          : '<i class="fas fa-mobile-alt"></i>') +
      '</div>' +
      '<div class="card-name-glossy">' + renderAppTitle(app) + '</div>' +
      '<div class="card-meta-glossy">' +
        '<span class="meta-v">v' + escapeHtml(app.version) + '</span>' +
        '<span class="meta-s">' + (app.fsize / 1024).toFixed(1) + ' MB</span>' +
      '</div>' +
      '<div class="card-os-glossy">iOS ' + formatOS(app.min_os) + '+ ' + getPlatformIcons(app.platform) + '</div>' +
      '<button class="get-btn-glossy" onclick="openModal(\'' + app.pk + '\')">Get</button>';
    container.appendChild(card);
  });

  searchResults.appendChild(container);
}

function renderGrid(data, page) {
  page = page || 0;
  searchResults.innerHTML = '';
  var slice = data.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  if (slice.length === 0) {
    emptyState.style.display = 'flex';
    return;
  }
  emptyState.style.display = 'none';

  slice.forEach(function(app) {
    var card = document.createElement('div');
    card.className = 'app-card-grid-aesthetic';
    card.innerHTML =
      '<div class="card-icon-glossy">' +
        (app.icon
          ? '<img src="' + app.icon + '" alt="' + escapeHtml(app.title) + '" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<i class=\\\'fas fa-mobile-alt\\\'></i>\'">'
          : '<i class="fas fa-mobile-alt"></i>') +
      '</div>' +
      '<div class="card-name-glossy">' + renderAppTitle(app) + '</div>' +
      '<div class="card-meta-glossy">' +
        '<span class="meta-v">v' + escapeHtml(app.version) + '</span>' +
        '<span class="meta-s">' + (app.fsize / 1024).toFixed(1) + ' MB</span>' +
      '</div>' +
      '<div class="card-os-glossy">iOS ' + formatOS(app.min_os) + '+ ' + getPlatformIcons(app.platform) + '</div>' +
      '<button class="get-btn-glossy" onclick="openModal(\'' + app.pk + '\')">Get</button>';
    searchResults.appendChild(card);
  });
}

var VERSIONS_PER_PAGE = 21;

function renderVersionPage(bundleId, page) {
  page = page || 0;
  var container = document.querySelector('.versions-container[data-bid="' + bundleId + '"]');
  var pagination = document.querySelector('.versions-pagination[data-bid="' + bundleId + '"]');
  if (!container || !pagination) return;

  var allVersions = apps.filter(function(a) {
    return a.bundle_id === bundleId && a.bundle_id !== '';
  }).sort(function(a, b) {
    if (a.min_os !== b.min_os) return a.min_os - b.min_os;
    return String(a.version).localeCompare(String(b.version), undefined, { numeric: true });
  });

  var totalPages = Math.ceil(allVersions.length / VERSIONS_PER_PAGE);
  var slice = allVersions.slice(page * VERSIONS_PER_PAGE, (page + 1) * VERSIONS_PER_PAGE);

  container.innerHTML = '<ul class="version-list">' + slice.map(function(v) {
    var url = getAppUrl(v);
    var filename = v.path.split('/').pop();
    return '<li class="version-li">' +
      '<div class="version-header-row">' +
        '<div class="version-icon-mini card-icon-glossy">' +
          (v.icon
            ? '<img src="' + v.icon + '" alt="v' + v.version + '" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML=\'<i class=\\\'fas fa-mobile-alt\\\'></i>\'">'
            : '<i class="fas fa-mobile-alt"></i>') +
        '</div>' +
        '<div class="version-info-main">' +
          '<div class="version-name"><strong>v' + v.version + '</strong> (' + (v.fsize / 1024).toFixed(1) + ' MB)</div>' +
          '<div class="version-filename"><a href="' + url + '" rel="noopener noreferrer nofollow">' + filename + '</a></div>' +
          '<div class="version-os">Requires iOS ' + formatOS(v.min_os) + '+</div>' +
        '</div>' +
      '</div>' +
      '<div class="version-actions-grid" style="grid-template-columns: 1fr 1fr;">' +
        '<a href="' + url + '" download class="v-btn-action download-v">Download</a>' +
        '<button onclick="installIPA(' + v.pk + ')" class="v-btn-action install-v">Install</button>' +
      '</div>' +
    '</li>';
  }).join('') + '</ul>';

  pagination.innerHTML = '';
  if (totalPages > 1) {
    var wrap = document.createElement('div');
    wrap.className = 'pagination-wrap';
    var range = 2;
    var start = Math.max(0, page - range);
    var end = Math.min(totalPages - 1, page + range);

    if (page > 0) {
      var first = document.createElement('button');
      first.innerHTML = '&laquo;&laquo;';
      first.title = 'First Page';
      first.onclick = function(event) {
        event.stopPropagation();
        renderVersionPage(bundleId, 0);
      };
      wrap.appendChild(first);

      var prev = document.createElement('button');
      prev.innerHTML = '&laquo;';
      prev.onclick = function(event) {
        event.stopPropagation();
        renderVersionPage(bundleId, page - 1);
      };
      wrap.appendChild(prev);
    }

    for (var i = start; i <= end; i++) {
      var btn = document.createElement('button');
      btn.textContent = i + 1;
      if (i === page) btn.className = 'active';
      btn.onclick = function(event) {
        event.stopPropagation();
        renderVersionPage(bundleId, i);
      };
      wrap.appendChild(btn);
    }

    if (page < totalPages - 1) {
      var next = document.createElement('button');
      next.innerHTML = '&raquo;';
      next.onclick = function(event) {
        event.stopPropagation();
        renderVersionPage(bundleId, page + 1);
      };
      wrap.appendChild(next);

      var last = document.createElement('button');
      last.innerHTML = '&raquo;&raquo;';
      last.title = 'Last Page';
      last.onclick = function(event) {
        event.stopPropagation();
        renderVersionPage(bundleId, totalPages - 1);
      };
      wrap.appendChild(last);
    }

    if (totalPages > 10) {
      var spot = document.createElement('input');
      spot.type = 'number';
      spot.placeholder = '...';
      spot.className = 'pagination-spot';
      spot.onkeydown = function(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
          var p = parseInt(spot.value) - 1;
          if (!isNaN(p) && p >= 0 && p < totalPages) {
            renderVersionPage(bundleId, p);
          } else {
            spot.value = '';
          }
        }
      };
      wrap.appendChild(spot);
    }

    pagination.appendChild(wrap);
  }
}

// Segmented Controls
var deviceSegs = document.querySelectorAll('#deviceSegments > .segment');
for (var i = 0; i < deviceSegs.length; i++) {
  var seg = deviceSegs[i];
  seg.addEventListener('click', function() {
    var parent = seg.parentElement;
    var siblings = parent.querySelectorAll('.segment');
    for (var s = 0; s < siblings.length; s++) siblings[s].classList.remove('active');
    seg.classList.add('active');
    var hiddenInput = document.getElementById('device');
    hiddenInput.value = seg.getAttribute('data-value');
    applyFilters();
  });
}

var randomSegs = document.querySelectorAll('#randomCountSegments .segment');
for (var j = 0; j < randomSegs.length; j++) {
  var seg = randomSegs[j];
  seg.addEventListener('click', function() {
    var all = document.querySelectorAll('#randomCountSegments .segment');
    for (var s = 0; s < all.length; s++) {
      all[s].classList.remove('active');
    }
    seg.classList.add('active');
  });
}

uniqueCheck.addEventListener('change', function() {
  applyFilters();
});

function setActiveSegment(value) {
  var segments = document.querySelectorAll('#deviceSegments > .segment');
  for (var s = 0; s < segments.length; s++) {
    if (segments[s].getAttribute('data-value') === value) {
      segments[s].classList.add('active');
    } else {
      segments[s].classList.remove('active');
    }
  }
}

function closestAncestor(el, selector) {
  while (el) {
    if (el.matches && el.matches(selector)) return el;
    el = el.parentElement;
  }
  return null;
}

function createModal(app) {
  var modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML =
    '<div class="modal-sub-header">' +
      '<button class="modal-close-btn" onclick="closeModal(this)">Close</button>' +
      '<div class="modal-sub-header-title">App Info</div>' +
      '<div style="width:70px;"></div>' +
    '</div>' +
    '<div class="modal-content">' +
      '<div class="modal-app-header">' +
        '<div class="modal-app-icon">' +
          (app.icon ? '<img src="' + app.icon + '" alt="' + escapeHtml(app.title) + '" loading="lazy">' : '<i class="fas fa-mobile-alt"></i>') +
        '</div>' +
        '<div class="modal-app-info">' +
          '<div class="modal-app-title">' + escapeHtml(app.title) + '</div>' +
          '<div class="modal-app-developer">' + escapeHtml(app.bundle_id) + '</div>' +
        '</div>' +
        '<button class="primary-btn" style="width: 80px; height: 32px;" onclick="toggleVersions(this)">Get</button>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3><i class="fas fa-mobile-alt"></i> Compatibility</h3>' +
        '<p>Requires iOS ' + formatOS(app.min_os) + ' or later.</p>' +
        '<p>Devices: ' + getPlatformIcons(app.platform) + '</p>' +
      '</div>' +
      '<div class="modal-section">' +
        '<h3><i class="fas fa-screwdriver-wrench"></i> Install on device</h3>' +
        '<p style="font-size:12px; color:#666; margin-bottom:10px;">' +
          'Unfortunatelly, this function is not possible with static HTML+JS. ' +
          'You must provided a plist generator URL. See <a href="https://github.com/yoloforks/ipa-archive?tab=readme-ov-file#starting-plist-server" target="_blank" style="color:#0a84ff; text-decoration:underline;">Readme</a> file for further instructions on how to set up such a service.' +
        '</p>' +
        '<button onclick="document.getElementById(\'plistConfigArea\').style.display=\'flex\'" class="get-btn-glossy" style="padding:6px 12px; font-size:12px; margin-bottom:10px;">Configure now</button>' +
        '<div id="plistConfigArea" class="plist-config-row" style="display: ' + (plistServerUrl ? 'flex' : 'none') + '; flex-wrap: wrap;">' +
          '<input type="text" id="plistServerInput" value="' + plistServerUrl + '" placeholder="http://192.168.0.1/" class="ios-input" style="font-size:12px; padding:6px 10px; flex: 1; min-width: 180px;">' +
          '<button onclick="savePlistServer()" class="get-btn-glossy" style="padding:6px 12px; font-size:12px; background: var(--ios-blue); color: white; border-color: #135a9a;">Save</button>' +
          '<button onclick="document.getElementById(\'plistConfigArea\').style.display=\'none\'" class="get-btn-glossy" style="padding:6px 12px; font-size:12px; background: var(--ios-grey); color: #333; border-color: #bbb;">Abort</button>' +
        '</div>' +
      '</div>' +
      '<div class="version-sheet-overlay" onclick="if(event.target === this) this.classList.remove(\'active\')">' +
        '<div class="version-sheet">' +
          '<h3 class="version-sheet-title">Version History</h3>' +
          '<div class="versions-container" data-bid="' + app.bundle_id + '"></div>' +
          '<div class="versions-pagination ios-pagination" style="margin-top:15px;" data-bid="' + app.bundle_id + '"></div>' +
        '</div>' +
      '</div>' +
    '</div>';

  setTimeout(function() {
    renderVersionPage(app.bundle_id, 0);
  }, 0);

  return modal;
}

function savePlistServer() {
  var input = document.getElementById('plistServerInput');
  var val = input.value.replace(/^\s+|\s+$/g, '');
  if (val && val.indexOf('http') !== 0) {
    alert('URL must start with http:// or https://');
    return;
  }
  plistServerUrl = val;
  try {
    localStorage.setItem('plistServerUrl', val);
  } catch(e) {}
  alert('Settings saved!');
}

function installIPA(pk) {
  if (!plistServerUrl) {
    alert('Please configure a Plist Server URL in the "Installation" section.');
    return;
  }
  var app = null;
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].pk === pk) {
      app = apps[i];
      break;
    }
  }
  if (!app) return;

  var thisServerUrl = location.href.split('#')[0].split('?')[0];
  var data = {
    u: getAppUrl(app),
    n: app.title,
    b: app.bundle_id,
    v: app.version.split(' ')[0],
    i: thisServerUrl + app.icon
  };

  var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data)))).replace(/=/g, '');
  var sep = plistServerUrl.indexOf('?') !== -1 ? '&' : '?';
  var plistUrl = plistServerUrl + sep + 'd=' + b64;
  window.open('itms-services://?action=download-manifest&url=' + encodeURIComponent(plistUrl));
}

function openModal(pk) {
  var app = null;
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].pk == pk) {
      app = apps[i];
      break;
    }
  }
  if (!app) return;
  var modal = createModal(app);
  modalContainer.appendChild(modal);
  document.body.style.overflow = 'hidden';

  setTimeout(function() {
    modal.classList.add('active');
    renderVersionPage(app.bundle_id, 0);
  }, 10);
}

function closeModal(btn) {
  var modal = closestAncestor(btn, '.modal-overlay');
  modal.classList.remove('active');
  document.body.style.overflow = 'auto';
  setTimeout(function() {
    if (modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }, 400);
}

function toggleVersions(btn) {
  var content = closestAncestor(btn, '.modal-content');
  var sheet = content.querySelector('.version-sheet-overlay');
  sheet.classList.toggle('active');
}

function buildQueryString(data) {
  var parts = [];
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(data[key]));
    }
  }
  return parts.join('&');
}

function parseQueryString(str) {
  var params = {};
  var pairs = str.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var pair = pairs[i].split('=');
    if (pair[0]) {
      params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
  }
  return params;
}

function saveConfig() {
  var data = {
    q: searchInput.value,
    bid: bundleInput.value,
    min: minosInput.value,
    max: maxosInput.value,
    dev: deviceSelect.value,
    uni: uniqueCheck.checked,
    p: currentPage
  };
  window.history.replaceState({}, '', window.location.pathname + '#' + buildQueryString(data));
}

function loadConfig() {
  if (!location.hash) return;
  var params = parseQueryString(location.hash.substring(1));
  searchInput.value = params['q'] || '';
  bundleInput.value = params['bid'] || '';
  minosInput.value = params['min'] || '';
  maxosInput.value = params['max'] || '';
  var devValue = params['dev'] || '';
  deviceSelect.value = devValue;
  setActiveSegment(devValue);
  uniqueCheck.checked = params['uni'] !== 'false';
  currentPage = parseInt(params['p']) || 0;
  if (location.hash.length > 2) applyFilters(currentPage);
}

fetchAppsData(function(err) {
  if (err) {
    console.error(err);
    return;
  }
  loadConfig();
  if (!location.hash || location.hash.length <= 1) applyFilters();
});

// Theme Toggle
var currentTheme = '';
try {
  currentTheme = localStorage.getItem('theme') || '';
} catch(e) {}
var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
var isDark = currentTheme ? currentTheme === 'dark' : prefersDark;
if (isDark) document.body.classList.add('dark');

function toggleTheme() {
  var dark = document.body.classList.toggle('dark');
  try {
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  } catch(e) {}
  var icon = document.getElementById('themeIcon');
  if (icon) icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
}

document.addEventListener('DOMContentLoaded', function() {
  var icon = document.getElementById('themeIcon');
  if (icon && document.body.classList.contains('dark')) {
    icon.className = 'fas fa-sun';
  }
});

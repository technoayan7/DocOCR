// Make these references accessible to all functions
let imageFilesInput;
let processingResults = [];
let promptTextarea;
let temperatureInput;

// Define API base URL
const API_BASE_URL = 'https://dococr.onrender.com';

// Generate summary from results
function updateSummary() {
    let html = '<div class="summary-stats">';

    // Count totals
    const totalFiles = processingResults.length;
    const successfulFiles = processingResults.filter(r => r.result).length;
    const failedFiles = processingResults.filter(r => r.error).length;

    // Generate stats
    html += `
        <div class="stat-item">
            <div class="stat-value">${totalFiles}</div>
            <div class="stat-label">Total Documents</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${successfulFiles}</div>
            <div class="stat-label">Successfully Processed</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${failedFiles}</div>
            <div class="stat-label">Failed</div>
        </div>
    `;
    html += '</div>';

    // Display only filename and result field value
    html += '<div class="data-insights"><h3>Document Insights</h3><ul>';
    processingResults.forEach(result => {
        if (result.result) {
            let displayResult = '';
            if (Array.isArray(result.result)) {
                displayResult = result.result.map((item, idx) => `Item ${idx + 1}: ${JSON.stringify(item)}`).join(' | ');
            } else if (typeof result.result === 'object') {
                displayResult = JSON.stringify(result.result);
            } else {
                displayResult = result.result;
            }
            html += `<li><strong>${result.filename}</strong>: ${displayResult}</li>`;
        } else if (result.error) {
            html += `<li><strong>${result.filename}</strong>: Error = ${result.error}</li>`;
        }
    });
    html += '</ul></div>';

    resultsSummary.innerHTML = html;
}

// Updated helper function to flatten each processing result object by merging all result keys.
function flattenResult(item) {
    const flattened = { filename: item.filename, model: item.model };
    if (item.result && typeof item.result === 'object' && !Array.isArray(item.result)) {
        // Merge all key-value pairs from result
        Object.assign(flattened, item.result);
    } else if (item.error) {
        flattened.error = item.error;
    }
    return flattened;
}

// Update JSON download handler to use the updated flattened results
downloadBtn.addEventListener('click', () => {
    if (processingResults.length === 0) return;
    const flattenedResults = processingResults.map(flattenResult);
    const blob = new Blob([JSON.stringify(flattenedResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;

    // Create a timestamp for the filename
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    a.download = `document-verification-results-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Add copy results button event listener
copyBtn.addEventListener('click', () => {
    const resultText = JSON.stringify(processingResults, null, 2);
    navigator.clipboard.writeText(resultText)
    .then(() => {
        statusText.textContent = 'Results copied to clipboard!';
    })
    .catch(err => {
        statusText.textContent = 'Failed to copy results.';
        console.error('Copy error:', err);
    });
});

// Add CSV download button event listener
downloadCSVBtn.addEventListener('click', () => {
    const flattenedResults = processingResults.map(flattenResult);
    
    // Compute union of all result keys (excluding filename and model)
    const resultKeysSet = new Set();
    flattenedResults.forEach(item => {
        Object.keys(item).forEach(key => {
            if (key !== 'filename' && key !== 'model') {
                resultKeysSet.add(key);
            }
        });
    });
    const resultKeys = Array.from(resultKeysSet);
    
    // Construct header row with fixed columns plus dynamic result keys
    const header = ['Image Name', 'Model Name', ...resultKeys];
    
    // Construct rows using header order
    const rows = flattenedResults.map(item => {
        const row = [];
        row.push(`"${item.filename}"`);
        row.push(`"${item.model}"`);
        resultKeys.forEach(key => {
            row.push(`"${item[key] !== undefined ? item[key] : ''}"`);
        });
        return row.join(',');
    });
    
    const csvContent = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    // Create a timestamp for the filename
    const date = new Date();
    const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `document-results-${timestamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Helper function to sanitize response text
function sanitizeResponse(text) {
    // Remove any code fences or backticks
    return text.replace(/```[\s\S]*?```/g, '').replace(/`/g, '');
}

// Helper function to parse JSON if possible
function parseIfPossible(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}

// Function to process a single image through OpenRouter
async function processImageWithOpenRouter(file) {
    try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('prompt', promptTextarea.value);
        formData.append('temperature', temperatureInput.value);
        formData.append('model', document.getElementById('model').value); // Added: use selected model

        const response = await fetch(`${API_BASE_URL}/api/process-image`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.error ||
                `Server error: ${response.status} ${response.statusText}`
            );
        }

        const data = await response.json();
        if (data.success && data.result) {
            return data.result; // Return full dynamic result
        } else {
            throw new Error('Invalid response from server');
        }
    } catch (error) {
        console.error('Fetch error:', error);

        // Handle non-JSON responses
        if (error.message.includes('Unexpected token')) {
            throw new Error('Server returned an invalid response. Please check the server logs.');
        }

        throw new Error(`Network error: ${error.message}`);
    }
}

// Helper function to show error messages
function showError(message) {
    statusText.innerHTML = `<span class="error">${message}</span>`;
    statusText.className = 'status error';
}

// Add additional styling for summary page
function addSummaryStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .summary-stats {
            display: flex;
            justify-content: space-between;
            margin-bottom: 24px;
        }
        
        .stat-item {
            background-color: white;
            border-radius: 8px;
            padding: 16px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            flex: 1;
            margin: 0 8px;
            border: 1px solid var(--gray-200);
        }
        
        .stat-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 8px;
        }
        
        .stat-label {
            color: var(--gray-600);
            font-size: 0.9rem;
        }
        
        .data-insights {
            background-color: white;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            border: 1px solid var(--gray-200);
        }
        
        .data-insights h3 {
            margin-bottom: 12px;
            color: var(--gray-800);
            font-size: 1.1rem;
        }
        
        .insight-item {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid var(--gray-200);
        }
        
        .insight-item:last-child {
            border-bottom: none;
        }
        
        .insight-label {
            color: var(--gray-700);
        }
        
        .insight-value {
            font-weight: 500;
        }
        
        .error-summary {
            background-color: white;
            border-radius: 8px;
            padding: 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            border: 1px solid var(--gray-200);
        }
        
        .error-summary h3 {
            margin-bottom: 12px;
            color: var(--danger);
            font-size: 1.1rem;
        }
        
        .error-summary ul {
            padding-left: 20px;
        }
        
        .error-summary li {
            margin-bottom: 8px;
            color: var(--gray-700);
        }
        
        .file-upload-active {
            border-color: var(--primary);
            background-color: rgba(58, 134, 255, 0.05);
        }
    `;
    document.head.appendChild(style);
}

// Update the file upload to increment count and enable process button
function initFileUpload() {
    const dropZone = document.getElementById('dropZone');
    imageFilesInput = document.getElementById('imageFiles'); // Moved to global scope
    const fileList = document.getElementById('fileList');
    const fileCountSpan = document.getElementById('fileCount');
    const processBtn = document.getElementById('processBtn');

    // ...existing code for drag/drop...

    imageFilesInput.addEventListener('change', () => {
        const files = Array.from(imageFilesInput.files);
        fileList.innerHTML = ''; // Clear existing
        files.forEach(file => {
            // ...existing code to display file...
        });
        // Update file count and toggle button
        fileCountSpan.textContent = files.length;
        processBtn.disabled = files.length === 0;
    });
}

// Process all uploaded images
async function processAllImages() {
    const files = Array.from(imageFilesInput.files);
    if (!files.length) return;

    // Record overall start time
    const overallStartTime = performance.now();

    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    statusText.textContent = 'Processing documents...';
    statusText.className = 'status loading';
    processingResults = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const result = await processImageWithOpenRouter(file);
            processingResults.push({
                filename: file.name,
                model: document.getElementById('model').value, // Store the selected model
                result // Full result object
            });
        } catch (error) {
            processingResults.push({
                filename: file.name,
                model: document.getElementById('model').value,
                error: error.message
            });
        }
        const progressPercent = ((i + 1) / files.length) * 100;
        progressBar.style.width = `${progressPercent}%`;
    }
    
    // Record overall end time and calculate average latency
    const overallEndTime = performance.now();
    const totalTime = overallEndTime - overallStartTime;
    const avgLatencySec = (totalTime / files.length / 1000).toFixed(2);

    // Update latency display element with an icon and average latency in sec
    const latencyDisplay = document.getElementById('latencyDisplay');
    if (latencyDisplay) {
        latencyDisplay.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            Average Latency: ${avgLatencySec} sec
        `;
    }

    const displayResults = processingResults.map(item => {
        if (item.result && typeof item.result === 'object' && !Array.isArray(item.result)) {
            return { filename: item.filename, ...item.result };
        } else if (item.error) {
            return { filename: item.filename, error: item.error };
        }
        return { filename: item.filename, result: item.result };
    });
    resultsOutput.textContent = JSON.stringify(displayResults, null, 2);

    resultsSection.style.display = 'block';
    updateSummary();
    copyBtn.style.display = 'inline-block';
    downloadBtn.style.display = 'inline-block';

    statusText.textContent = 'Done processing!';
    statusText.className = 'status success';
}

// Initialize the application
function init() {
    // Define references to prompt and temperature fields
    promptTextarea = document.getElementById('prompt');
    temperatureInput = document.getElementById('temperature');

    initFileUpload();
    addSummaryStyles();

    // Hide results section initially
    resultsSection.style.display = 'none';

    // Initially hide download and copy buttons
    downloadBtn.style.display = 'none';
    copyBtn.style.display = 'none';

    // Add the event listener here
    processBtn.addEventListener('click', processAllImages);
}

// Run initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Tab switching functionality for results
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.getAttribute('data-tab') + "Tab";
            document.querySelectorAll('.results-content').forEach(content => {
                content.style.display = "none";
            });
            document.getElementById(targetTab).style.display = "block";
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
        });
    });
});

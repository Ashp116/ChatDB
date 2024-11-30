const chatBox = document.getElementById('chat-box');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');
const dbResults = document.getElementById('db-results');
const dbColumns = document.getElementById('db-columns');
const searchInput = document.getElementById('search-input');
const prevButton = document.getElementById('prev-button');
const nextButton = document.getElementById('next-button');
const pageSizeSelect = document.getElementById('page-size');
const currentPageText = document.getElementById('current-page');
const totalPagesText = document.getElementById('total-pages');

let table_data = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;

let botTypingElement;
let botTypingIntervalId;

// WebSocket Connection
const ws = new WebSocket("ws://localhost:8765");

// Open Connection
ws.addEventListener("open", () => {
  console.log("Connected to WebSocket server.");
});

// Listen for messages
ws.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  console.log("Message from server:", data);

  // Example: Display the response in the chat box
  if (botTypingElement) {
    setTimeout(() => {
      clearInterval(botTypingIntervalId);
      botTypingElement.remove()
    }, 1);
  }

  const botMessage = document.createElement('div');
  botMessage.className = 'p-3 bg-gray-700 text-gray-300 rounded-lg max-w-[70%] mb-2 self-start';
  botMessage.textContent = `${data.reply}`;
  chatBox.appendChild(botMessage);
  chatBox.scrollTop = chatBox.scrollHeight;

  setTimeout(() => {
    // Display the DB result if available
    if (data.db_result) {
      table_data = data.db_result;
      filteredData = [...table_data]; // Initially set the filtered data to all data
      populateDbTable(filteredData);
    } else {
      table_data = [];
      filteredData = [];
      populateDbTable(filteredData);
    }
  }, 500);
});

// Handle WebSocket Errors
ws.addEventListener("error", (error) => {
  console.error("WebSocket error:", error);
});

// Handle WebSocket Close
ws.addEventListener("close", () => {
  console.log("Disconnected from WebSocket server.");
});

// Bot typing
const botTyping = () => {
  botTypingElement = document.createElement('div');
  botTypingElement.className = 'p-3 bg-gray-700 text-gray-300 rounded-lg max-w-[70%] mb-2 self-start';
  chatBox.appendChild(botTypingElement);
  chatBox.scrollTop = chatBox.scrollHeight;

  let typingText = "";
  botTypingElement.textContent = typingText

  botTypingIntervalId = setInterval(() => {
    if (typingText.length === 3) {
      typingText = ".";
    }
    else {
      typingText += ".";
    }
    botTypingElement.textContent = typingText
  }, 500);
};

// Send a Message to the Server
sendButton.addEventListener('click', () => {
  const message = chatInput.value.trim();

  if (message) {
    // Send a JSON message to the server
    const payload = JSON.stringify({ user_input: message });
    ws.send(payload);

    // Display user message in the chat box
    const userMessage = document.createElement('div');
    userMessage.className = 'p-3 bg-cyan-500 text-gray-900 rounded-lg max-w-[70%] mb-2 self-end ml-auto';
    userMessage.textContent = `You: ${message}`;
    chatBox.appendChild(userMessage);
    chatInput.value = '';
    botTyping()
  }
});

// Function to populate the DB table with paginated data
const populateDbTable = (data, update = false) => {
  if (!update) {
    while (dbColumns.firstChild) {
      dbColumns.firstChild.remove();
    }
  }

  while (dbResults.firstChild) {
    dbResults.firstChild.remove();
  }

  if (!data || data.length === 0) {
    const noDataMessage = document.createElement('tr');
    noDataMessage.innerHTML = `<td colspan="3" class="text-center p-2">No results found</td>`;
    dbResults.appendChild(noDataMessage);
    updatePaginationControls(0, 0); // Update controls when no data
    return;
  }

  // Calculate total pages based on page size
  totalPages = Math.ceil(data.length / pageSize);

  // Slice the data for the current page
  const pageData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Dynamically create table headers based on the keys of the first result (only if the table is empty)
  if (!update && dbResults.children.length === 0) {
    const headers = Object.keys(data[0]);
    const headerRow = document.createElement('tr');
    headerRow.classList.add("bg-gray-800");

    headers.forEach(header => {
      const th = document.createElement('th');
      th.className = 'border border-gray-700 p-2 cursor-pointer hover:bg-gray-600 hover:text-gray-900 transition-all';
      th.innerHTML = `${header} <span class="text-xs">↕</span>`;
      th.addEventListener('click', () => {
        sortTable(header);
      });
      headerRow.appendChild(th);
    });

    dbColumns.appendChild(headerRow);
  }

  // Populate table rows
  pageData.forEach(row => {
    const tr = document.createElement('tr');
    Object.keys(row).forEach(header => {
      const td = document.createElement('td');
      td.className = 'border border-gray-700 p-2';
      td.textContent = row[header];
      tr.appendChild(td);
    });
    dbResults.appendChild(tr);
  });

  updatePaginationControls(currentPage, totalPages);
};

// Update Pagination Controls (Previous, Next, Page size, and Current Page)
const updatePaginationControls = (currentPage, totalPages) => {
  currentPageText.textContent = currentPage;
  totalPagesText.textContent = totalPages;

  prevButton.disabled = currentPage === 1;
  nextButton.disabled = currentPage === totalPages;

  pageSizeSelect.value = pageSize;
};

// Pagination button actions
prevButton.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    populateDbTable(filteredData);
  }
});

nextButton.addEventListener('click', () => {
  if (currentPage < totalPages) {
    currentPage++;
    populateDbTable(filteredData);
  }
});

// Page size change
pageSizeSelect.addEventListener('change', (event) => {
  pageSize = parseInt(event.target.value);
  currentPage = 1;
  populateDbTable(filteredData);
});

// Search functionality
searchInput.addEventListener('input', () => {
  const query = searchInput.value.toLowerCase();
  filteredData = table_data.filter(item => {
    return Object.values(item).some(val => val.toString().toLowerCase().includes(query));
  });
  currentPage = 1;
  populateDbTable(filteredData);
});

// Sorting Functionality
let sortOrder = 'asc'; // Ascending by default
const sortTable = (header) => {
  filteredData.sort((a, b) => {
    if (a[header] < b[header]) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (a[header] > b[header]) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  // Toggle sort order for next click
  sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
  populateDbTable(filteredData, true);
};

// Initial population (assuming table_data is available)
populateDbTable(table_data);

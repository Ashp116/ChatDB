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
const errorOverlay = document.getElementById('error-overlay');

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
  errorOverlay.classList.remove('hidden');
});

// Bot typing
const botTyping = () => {
  botTypingElement = document.createElement('div');
  botTypingElement.className = 'p-3 bg-gray-700 text-gray-300 rounded-lg max-w-[70%] mb-2 self-start';
  chatBox.appendChild(botTypingElement);

  let typingText = ".";
  botTypingElement.textContent = typingText

  chatBox.scrollTop = chatBox.scrollHeight;
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

const sendUserMessage = (payload, message) => {
  ws.send(payload);

  // Display user message in the chat box
  const userMessage = document.createElement('div');
  userMessage.className = 'p-3 bg-cyan-500 text-gray-900 rounded-lg max-w-[70%] mb-2 self-end ml-auto';
  userMessage.textContent = `You: ${message}`;
  chatBox.appendChild(userMessage);
  chatInput.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;
  botTyping()
}

// Send a Message to the Server
sendButton.addEventListener('click', () => {
  const message = chatInput.value.trim();

  if (message) {
    // Send a JSON message to the server
    const payload = JSON.stringify({ user_input: message });
    sendUserMessage(payload, message);
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
    tr.classList.add("hover:bg-cyan-700")
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

// Search Functionality with Column Filter
searchInput.addEventListener('input', () => {
  const searchQuery = searchInput.value.trim().toLowerCase();

  // Check if the search query contains a column filter (e.g., name=John)
  const columnSearchMatch = searchQuery.match(/^(\w+)\s*=\s*(.+)$/);

  if (columnSearchMatch) {
    const [_, column, searchTerm] = columnSearchMatch;

    // Check if the column exists and filter accordingly
    if (table_data[0][column]) {
      const filteredData = table_data.filter(row =>
        row[column].toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
      // Populate DB table with filtered results
      populateDbTable(filteredData);
    }
  } else {
    // If no column-specific search, search across all columns
    const filteredData = table_data.filter(row =>
      Object.values(row).some(value =>
        value.toString().toLowerCase().includes(searchQuery)
      )
    );
    // Populate DB table with filtered results
    populateDbTable(filteredData);
  }
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


const schemaButton = document.getElementById('edit-schema-button');
const schemaOverlay = document.getElementById('schema-overlay');
const closeSchemaButton = document.getElementById('close-schema-button');
const saveSchemaButton = document.getElementById('save-schema-button');
const schemaContent = document.getElementById('schema-content');

// Sample schema data (should be replaced with actual database schema data)
const schemaData = [
  {
    tableName: 'Users',
    columns: [
      { name: 'ID', dataType: 'INTEGER' },
      { name: 'Name', dataType: 'VARCHAR(100)' },
      { name: 'Email', dataType: 'VARCHAR(100)' }
    ]
  },
  {
    tableName: 'Orders',
    columns: [
      { name: 'OrderID', dataType: 'INTEGER' },
      { name: 'UserID', dataType: 'INTEGER' },
      { name: 'Amount', dataType: 'DECIMAL' }
    ]
  },
    {
    tableName: 'Users',
    columns: [
      { name: 'ID', dataType: 'INTEGER' },
      { name: 'Name', dataType: 'VARCHAR(100)' },
      { name: 'Email', dataType: 'VARCHAR(100)' }
    ]
  },
  {
    tableName: 'Orders',
    columns: [
      { name: 'OrderID', dataType: 'INTEGER' },
      { name: 'UserID', dataType: 'INTEGER' },
      { name: 'Amount', dataType: 'DECIMAL' }
    ]
  },
];

function renderSchema(schemaData) {
  const schemaContent = document.getElementById('schema-content');
  schemaContent.innerHTML = ''; // Clear previous content

  schemaData.forEach((table) => {
    // Create table node
    const tableNode = document.createElement('div');
    tableNode.classList.add('space-y-2');

    // Table name container
    const tableNameContainer = document.createElement('div');
    tableNameContainer.classList.add('flex', 'items-center', 'space-x-2', 'pr-2');

    // Add the toggle icon (for expanding/collapsing)
    const toggleIcon = document.createElement('i');
    toggleIcon.classList.add('fas', 'fa-minus', 'text-gray-500', 'cursor-pointer');

    // Table name
    const tableName = document.createElement('span');
    tableName.classList.add(
      'cursor-pointer',
      'text-gray-200',
      'flex',
      'items-center',
      'transition',
      'duration-200',
      'hover:bg-cyan-800',
      'hover:text-gray-200',
      'p-2',
      'rounded-md'
    );


    // Table name text
    const tableNameText = document.createElement('div');
    tableNameText.innerText = table.tableName;
    tableNameText.classList.add('flex-grow');
    tableNameText.classList.add(
      'cursor-pointer',
      'font-bold',
      'text-md',
      'text-gray-200',
      'flex',
      'items-center',
      'transition',
      'duration-200',
      'hover:bg-cyan-800',
      'hover:text-gray-200',
      'p-2',
      'rounded-md'
    );
    tableNameText.addEventListener('click', () => {
      selectTable(tableNameText, table.tableName);
    });

    // Append the toggle icon and table name text to the tableNameContainer
    tableNameContainer.appendChild(toggleIcon); // Add the minus sign for collapse/expand
    tableNameContainer.appendChild(tableNameText);
    tableNode.appendChild(tableNameContainer);

    // Create columns for the table (optional, for expanding/collapsing)
    const columnList = document.createElement('ul');
    columnList.classList.add('file-tree', 'ml-10'); // Add tree styling
    table.columns.forEach((column) => {
      const columnItem = document.createElement('li');
      columnItem.classList.add('ml-4', 'text-gray-500', 'text-sm', 'relative');
      columnItem.innerHTML = `<i class="fas fa-table mr-2"></i> ${column.name}: ${column.dataType}`;
      columnList.appendChild(columnItem);
    });

    // Add a click event to toggle the visibility of columns
    toggleIcon.addEventListener('click', () => {
      // Toggle the "+" and "-" icon
      if (toggleIcon.classList.contains('fa-plus')) {
        toggleIcon.classList.remove('fa-plus');
        toggleIcon.classList.add('fa-minus');
      } else {
        toggleIcon.classList.remove('fa-minus');
        toggleIcon.classList.add('fa-plus');
      }

      // Toggle the visibility of the columns
      columnList.classList.toggle('hidden');
    });

    // Append columns to table node
    tableNode.appendChild(columnList);

    // Add the table node to the schema content
    schemaContent.appendChild(tableNode);
  });

  // Add visual tree structure
  applyTreeVisuals();
}

// Function to apply tree visual indicators
function applyTreeVisuals() {
  const treeNodes = document.querySelectorAll('.file-tree li');

  treeNodes.forEach((node, index) => {
    // Add vertical tree line (applies to all nodes)
    const treeLineBefore = document.createElement('span');
    treeLineBefore.classList.add('tree-line-before');
    treeLineBefore.style.cssText = `
      content: '';
      position: absolute;
      left: -10px;
      top: 0;
      width: 2px;
      height: 100%;
      background-color: #555;
    `;
    node.insertAdjacentElement('afterbegin', treeLineBefore);

    // Add horizontal tree line (applies to all nodes)
    const treeLineAfter = document.createElement('span');
    treeLineAfter.classList.add('tree-line-after');
    treeLineAfter.style.cssText = `
      content: '';
      position: absolute;
      left: -10px;
      top: 10px;
      width: 10px;
      height: 2px;
      background-color: #555;
    `;
    node.insertAdjacentElement('afterbegin', treeLineAfter);

    // Check if the current node is the last child
    const isLastChild = node.nextElementSibling === null;

    if (isLastChild) {
      // Adjust the tree-line-before to form the L-shape
      treeLineBefore.style.height = '10px'; // Stops the vertical line at the horizontal connection
      treeLineAfter.style.backgroundColor = '#555'; // Keeps the horizontal line
    }
  });
}

// Array to store selected tables
let selectedTables = [];

// Function to select/deselect tables
function selectTable(node, tableName) {
  // Prevent event propagation to parent nodes
  event.stopPropagation();

  const item = node;
  const selectedTablesDiv = document.getElementById('selected-tables');

  // Find the index of the table in the schemaData to generate a unique ID
  const tableIndex = schemaData.findIndex(table => table.tableName === tableName);

  // Create a unique ID based on tableName and its index
  const uniqueId = `${tableName}-${tableIndex}`;

  // Toggle selection
  if (item.classList.contains('bg-cyan-600')) {
    item.classList.remove('bg-cyan-600', 'text-white');
    item.classList.add('text-gray-200');

    // Remove from selected list using uniqueId
    const selectedItem = selectedTablesDiv.querySelector(`[data-id="${uniqueId}"]`);
    if (selectedItem) {
      selectedItem.remove();
    }

    // Remove table from selectedTables array
    selectedTables = selectedTables.filter(table => table !== tableName);
  } else {
    item.classList.add('bg-cyan-600', 'text-white');

    // Add table to the selected list
    const tableSelected = document.createElement('div');
    tableSelected.classList.add('bg-cyan-600', 'text-white', 'px-4', 'py-2', 'rounded-lg', 'cursor-pointer', 'transition', 'duration-200', 'hover:bg-red-400');
    tableSelected.textContent = tableName;

    // Assign the unique ID to the selected table
    tableSelected.setAttribute('data-id', uniqueId);
    tableSelected.setAttribute('data-table', tableName);

    // Add event to toggle selection when clicked again
    tableSelected.onclick = () => {
      // Deselect the table when clicked again
      selectTable(item, tableName);
    };

    // Append the table to the selected tables list
    selectedTablesDiv.appendChild(tableSelected);

    // Add table to selectedTables array
    selectedTables.push(tableName);
  }
}

// Call the renderSchema function to render the schema data dynamically
renderSchema(schemaData);

// Open schema overlay
schemaButton.addEventListener('click', () => {
  schemaOverlay.classList.remove('hidden');
  renderSchema(schemaData); // Render the schema when opening
});

// Close schema overlay
closeSchemaButton.addEventListener('click', () => {
  schemaOverlay.classList.add('hidden');
});

// Save changes to the schema (you can then send the updated schema to the server)
saveSchemaButton.addEventListener('click', () => {
  schemaOverlay.classList.add('hidden');
  const payload = JSON.stringify({ schema_context_update: selectedTables });
  sendUserMessage(payload, `Updated datable schema context: ${selectedTables.join(", ")}`)
});

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
const schemaButton = document.getElementById('edit-schema-button');
const schemaOverlay = document.getElementById('schema-overlay');
const closeSchemaButton = document.getElementById('close-schema-button');
const saveSchemaButton = document.getElementById('save-schema-button');
const schemaContent = document.getElementById('schema-content');
const selectedTablesDiv = document.getElementById('selected-tables');

let table_data = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;

let botTypingElement;
let botTypingIntervalId;

let schemaData = [];
let selectedTables = {};

let sortOrder = 'asc'; // Ascending by default

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

  if (!data) return;

  if (data['reply']) {
    sendBotMessage(`${data.reply}`)

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
  }
  else if (data['db_schema_context']) {
    data['db_schema_context']['schema_data'].forEach((row) => {
      if (data['db_schema_context']['tables'].indexOf(row.tableName) === -1)
        return

      let uniqueId = `${row.tableName}-`;

      row.columns.forEach((val) => {
        uniqueId += `${val.name}(${val.dataType})`;
      })

      selectedTables[uniqueId] = row.tableName;
    })

    while (selectedTablesDiv.firstChild) {
      selectedTablesDiv.firstChild.remove();
    }

    schemaData = data['db_schema_context']['schema_data'];
    renderSchema(schemaData);
  }
  else if (data['schema_context_updated']) {
       sendBotMessage(`
          <p>I’ve just updated my database schema context to following tables:</p>
          <ul style="list-style-type: disc; padding-left: 20px;">
            ${data['schema_context_updated'].map(table => `<li><strong>${table}</strong></li>`).join('')}
          </ul>
        `, true);

  }
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

// Bot message
const sendBotMessage = (message, isMsgHTML) => {
  const botMessage = document.createElement('div');
  botMessage.className = 'p-3 bg-gray-700 text-gray-300 rounded-lg max-w-[70%] mb-2 self-start';

  if (isMsgHTML) botMessage.innerHTML = message;
  else botMessage.textContent = message;

  chatBox.appendChild(botMessage);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send payload to websocket server
const sendPayload = (payload) => {
    ws.send(payload);
}

// Send messages through the websocket
const sendUserMessage = (payload, message) => {
  if (payload) sendPayload(payload);

  // Display user message in the chat box
  const userMessage = document.createElement('div');
  userMessage.className = 'p-3 bg-cyan-500 text-gray-900 rounded-lg max-w-[70%] mb-2 self-end ml-auto';
  userMessage.textContent = `You: ${message}`;
  chatBox.appendChild(userMessage);
  chatInput.value = '';
  chatInput.dispatchEvent(new Event('change')); // To update the chat input field height
  chatBox.scrollTop = chatBox.scrollHeight;
  botTyping()
}

// Handle when there is a user input in the chat input element
const OnUserInput = () => {
  const message = chatInput.value.trim();

  if (message) {
    // Send a JSON message to the server
    const payload = JSON.stringify({ user_input: message });
    sendUserMessage(payload, message);
  }
}

// Function to handle user input field resizing
function adjustUserInputFieldHeight() {
  if (chatInput.value.trim() === '') {
    // Reset height to default when content is empty
    chatInput.style.height = 'auto';
    chatInput.style.overflowY = 'hidden';
  } else {
    // Adjust height dynamically for content
    chatInput.style.height = 'auto'; // Reset height to calculate new size
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 160)}px`; // Set height up to max-h-40
    chatInput.style.overflowY = chatInput.scrollHeight > 160 ? 'auto' : 'hidden'; // Enable scrolling if needed
  }
}

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

// Sorting Functionality
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

// Update the renderSchema function to add event listeners correctly
function renderSchema(schemaData) {
  const schemaContent = document.getElementById('schema-content');
  schemaContent.innerHTML = ''; // Clear previous content

  schemaData.forEach((table, index) => {
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

    let uniqueId = `${table.tableName}-`

    table.columns.forEach((val) => {
      uniqueId += `${val.name}(${val.dataType})`;
    })

    tableNameText.addEventListener('click', (e) => {
      handleTableSelection(e, table.tableName, uniqueId);
    });


    if (selectedTables[uniqueId]) {
      // Select the table
      tableNameText.classList.add('bg-cyan-600', 'text-white');

      // Add table to the selected list
      const tableSelected = document.createElement('div');
      tableSelected.classList.add('bg-cyan-600', 'text-white', 'px-4', 'py-2', 'rounded-lg', 'cursor-pointer', 'transition', 'duration-200', 'hover:bg-red-400');
      tableSelected.textContent = table.tableName;

      // Assign the unique ID to the selected table
      tableSelected.setAttribute('data-id', uniqueId);
      tableSelected.setAttribute('data-table', table.tableName);

      // Add event to toggle selection when clicked again
      tableSelected.onclick = () => {
        // Deselect the table when clicked again
        selectTable(tableNameText, table.tableName, uniqueId);
      };

      // Append the table to the selected tables list
      selectedTablesDiv.appendChild(tableSelected);

      // Add table to selectedTables array
      selectedTables[uniqueId] = table.tableName;
    }

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

// Function to select/deselect tables
function selectTable(node, tableName, uniqueId) {
  // Prevent event propagation to parent nodes
  event.stopPropagation();

  // Toggle selection
  if (node.classList.contains('bg-cyan-600')) {
    // Deselect the table
    node.classList.remove('bg-cyan-600', 'text-white');
    node.classList.add('text-gray-200');

    // Remove from selected list using uniqueId
    const selectedItem = selectedTablesDiv.querySelector(`[data-id="${uniqueId}"]`);
    if (selectedItem) {
      selectedItem.remove();
    }

    // Remove table from selectedTables array
    delete selectedTables[uniqueId];
  } else {
    // Select the table
    node.classList.add('bg-cyan-600', 'text-white');

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
      selectTable(node, tableName, uniqueId);
    };

    // Append the table to the selected tables list
    selectedTablesDiv.appendChild(tableSelected);

    // Add table to selectedTables array
    selectedTables[uniqueId] = tableName;
  }
}

// Function to handle table selection and removal correctly
const handleTableSelection = (e, tableName, uniqueId) => {
  const tableNode = selectedTablesDiv.querySelector(`[data-id="${uniqueId}"]`);

  if (tableNode) {
    // Remove the table from the selected list if it's already there
    tableNode.remove();
    delete selectedTables[uniqueId];
    e.target.classList.remove('bg-cyan-600', 'text-white');
    e.target.classList.add('text-gray-200');
  } else {
    // Add the table to the selected list if it's not already there
    selectTable(e.target, tableName, uniqueId);
  }
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

// Attach listeners to update height
chatInput.addEventListener('input', adjustUserInputFieldHeight);
chatInput.addEventListener('change', adjustUserInputFieldHeight);
chatInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    OnUserInput()
  }
});

// Send a Message to the Server
sendButton.addEventListener('click', OnUserInput);

// Open schema overlay
schemaButton.addEventListener('click', () => {
  schemaData = [];

  ws.send(JSON.stringify({
    get_schema_context: true
  }));

  schemaOverlay.classList.remove('hidden');
});

// Close schema overlay
closeSchemaButton.addEventListener('click', () => {
  schemaOverlay.classList.add('hidden');
});

// Save changes to the schema (you can then send the updated schema to the server)
saveSchemaButton.addEventListener('click', () => {
  schemaOverlay.classList.add('hidden');
  const payload = JSON.stringify({ schema_context_update: Object.values(selectedTables) });
  sendPayload(payload);
  botTyping();
});


// Initial population (assuming table_data is available)
populateDbTable(table_data);
// Call the renderSchema function to render the schema data dynamically
renderSchema(schemaData);
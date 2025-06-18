// Node attributes management
export const ATTRIBUTE_TYPES = {
  STRING: 'string',
  INTEGER: 'integer',
  FLOAT: 'float'
};

export function createAttribute(name, type = ATTRIBUTE_TYPES.STRING, value = '') {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    name,
    type,
    value: type === ATTRIBUTE_TYPES.STRING ? value : 
           type === ATTRIBUTE_TYPES.INTEGER ? parseInt(value) || 0 :
           type === ATTRIBUTE_TYPES.FLOAT ? parseFloat(value) || 0.0 : value
  };
}

export function validateAttributeValue(type, value) {
  switch (type) {
    case ATTRIBUTE_TYPES.STRING:
      return String(value);
    case ATTRIBUTE_TYPES.INTEGER:
      const intVal = parseInt(value);
      return isNaN(intVal) ? 0 : intVal;
    case ATTRIBUTE_TYPES.FLOAT:
      const floatVal = parseFloat(value);
      return isNaN(floatVal) ? 0.0 : floatVal;
    default:
      return value;
  }
}

export function addAttributeToNode(node, name, type, value) {
  if (!node.attributes) {
    node.attributes = [];
  }
  
  const attribute = createAttribute(name, type, value);
  node.attributes.push(attribute);
  return attribute;
}

export function removeAttributeFromNode(node, attributeId) {
  if (!node.attributes) return false;
  
  const index = node.attributes.findIndex(attr => attr.id === attributeId);
  if (index !== -1) {
    node.attributes.splice(index, 1);
    return true;
  }
  return false;
}

export function updateAttributeValue(node, attributeId, value) {
  if (!node.attributes) return false;
  
  const attribute = node.attributes.find(attr => attr.id === attributeId);
  if (attribute) {
    attribute.value = validateAttributeValue(attribute.type, value);
    return true;
  }
  return false;
} 